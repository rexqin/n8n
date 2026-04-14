---
name: n8n-release-deploy-latest
description: "用于 n8n 发布链路自动化。只要用户提到发布、删 release 但保留 tag、tag latest 并强推、监控 Release: Publish、发布后部署 ECS latest，就应触发本技能并按固定顺序执行。即使用户没写全流程，也要主动补齐为这条标准链路。"
---

# n8n Release + ECS 发布流程技能

## 适用场景

当用户出现以下任一意图时，使用本技能：

- 删除 GitHub release 本身，但不删除 tag
- 将当前提交设置为 `latest` tag 并强制推送
- 监控 `Release: Publish` workflow 到结束
- 在 `Release: Publish` 结束后触发 `Deploy: Aliyun ECS (n8n)`
- 部署参数指定 `n8n_version=latest`

## 固定执行顺序

严格按以下顺序执行，不要跳步：

1. **删除 release 本身（不删 tag）**
2. **更新并强推 `latest` tag**
3. **监控 `Release: Publish` 到完成**
4. **执行 ECS deploy（`n8n_version=latest`）**
5. **回报 run 链接与最终状态**

## 关键规则

- 删除 release 时，必须使用不带 `--cleanup-tag` 的命令。
- 任何 tag 相关操作都要先回显当前 commit 短 hash，避免误推。
- 监控 workflow 期间，如果超时进入后台，必须持续轮询直到 workflow 终态（`success` / `failure` / `cancelled`）。
- 无论 `Release: Publish` 成功或失败，只要用户明确要求“执行完以后再 deploy”，都应在它结束后继续触发 ECS 部署。
- 禁止使用 `--force` 推送分支；仅允许对 tag 使用 `--force`（用户已明确要求时）。

## 标准命令模板

### 1) 删除 release（不删 tag）

```bash
gh release delete "<tag>" --yes
```

示例：

```bash
gh release delete stable --yes
gh release delete "n8n@2.14.10" --yes
```

### 2) 更新 `latest` 并强推

```bash
git rev-parse --short HEAD
git tag -f latest
git push origin latest --force
```

### 3) 定位并监控 `Release: Publish`

```bash
gh run list --workflow "Release: Publish" --limit 5
gh run watch <run_id> --exit-status
```

若 `watch` 进入后台，继续轮询：

```bash
gh run view <run_id> --json status,conclusion,url
```

### 4) workflow 结束后触发 ECS latest 部署

```bash
gh workflow run "Deploy: Aliyun ECS (n8n)" -f n8n_version=latest
gh run view <deploy_run_id> --json status,conclusion,workflowName,url,displayTitle
```

## 输出格式（给用户）

每次执行结束后按下面结构汇报：

- 已删除的 release（明确“未删除 tag”）
- `latest` 更新前后信息（至少包含当前短 hash）
- `Release: Publish` run id、结论、链接
- `Deploy: Aliyun ECS (n8n)` run id、当前状态、链接

建议格式：

```text
1) Release 删除：xxx（tag 保留）
2) latest 更新：<old> -> <new>
3) Release: Publish：run <id>，<conclusion>，<url>
4) Deploy ECS：run <id>，<status>，<url>
```

## 异常处理

- 若 release 不存在：继续流程，并明确提示“目标 release 不存在，已跳过”。
- 若 `latest` 推送失败：立即停止并返回错误，不继续后续步骤。
- 若找不到 `Release: Publish` 在跑：选最近一条并监控到结束，回报采用的 run id。
- 若 deploy 触发失败：返回完整报错并给出下一步建议（重试命令）。
