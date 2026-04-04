import type { RouterMiddleware } from '@/app/types/router';
import { VIEWS } from '@/app/constants';
import type { AuthenticatedPermissionOptions } from '@/app/types/rbac';
import { isAuthenticated, shouldEnableMfa } from '@/app/utils/rbac/checks';
import { useSSOStore } from '@/features/settings/sso/sso.store';

export const authenticatedMiddleware: RouterMiddleware<AuthenticatedPermissionOptions> = async (
	to,
	_from,
	next,
	options,
) => {
	// ensure that we are removing the already existing redirect query parameter
	// to avoid infinite redirect loops
	const url = new URL(window.location.href);
	url.searchParams.delete('redirect');
	const redirect = to.query.redirect ?? encodeURIComponent(`${url.pathname}${url.search}`);

	const valid = isAuthenticated(options);
	if (!valid) {
		const ssoStore = useSSOStore();
		if (ssoStore.showSsoLoginButton) {
			try {
				const samlRedirectHint =
					typeof to.query?.redirect === 'string' ? to.query.redirect : redirect;
				const redirectUrl = ssoStore.isDefaultAuthenticationSaml
					? await ssoStore.getSSORedirectUrl(samlRedirectHint as string)
					: ssoStore.oidc.loginUrl;
				if (redirectUrl) {
					window.location.href = redirectUrl;
					return next(false);
				}
			} catch {
				// Fall through to sign-in page (same as SSOLogin error handling without blocking navigation).
			}
		}
		return next({ name: VIEWS.SIGNIN, query: { redirect } });
	}

	// If MFA is not enabled, and the instance enforces MFA, redirect to personal settings
	const mfaNeeded = shouldEnableMfa();
	if (mfaNeeded) {
		if (to.name !== VIEWS.PERSONAL_SETTINGS) {
			return next({ name: VIEWS.PERSONAL_SETTINGS, query: { redirect } });
		}
		return;
	}
};
