import { authenticatedMiddleware } from '@/app/utils/rbac/middleware/authenticated';
import { useSSOStore } from '@/features/settings/sso/sso.store';
import { useUsersStore } from '@/features/settings/users/users.store';
import { VIEWS } from '@/app/constants';
import type { RouteLocationNormalized } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('@/features/settings/users/users.store', () => ({
	useUsersStore: vi.fn(),
}));

vi.mock('@/features/settings/sso/sso.store', () => ({
	useSSOStore: vi.fn(),
}));

describe('Middleware', () => {
	describe('authenticated', () => {
		beforeEach(() => {
			setActivePinia(createPinia());
			vi.mocked(useSSOStore).mockReturnValue({
				showSsoLoginButton: false,
				isDefaultAuthenticationSaml: false,
				getSSORedirectUrl: vi.fn(),
				oidc: { loginUrl: '' },
			} as unknown as ReturnType<typeof useSSOStore>);
		});

		it('should redirect to signin if no current user is present', async () => {
			vi.mocked(useUsersStore).mockReturnValue({ currentUser: null } as ReturnType<
				typeof useUsersStore
			>);

			const nextMock = vi.fn();
			const toMock = { query: {} } as RouteLocationNormalized;
			const fromMock = {} as RouteLocationNormalized;

			await authenticatedMiddleware(toMock, fromMock, nextMock, {});

			expect(nextMock).toHaveBeenCalledWith({
				name: VIEWS.SIGNIN,
				query: { redirect: encodeURIComponent('/') },
			});
		});

		it('should call next with the correct redirect query if present', async () => {
			vi.mocked(useUsersStore).mockReturnValue({ currentUser: null } as ReturnType<
				typeof useUsersStore
			>);

			const nextMock = vi.fn();
			const toMock = { query: { redirect: '/' } } as unknown as RouteLocationNormalized;
			const fromMock = {} as RouteLocationNormalized;

			await authenticatedMiddleware(toMock, fromMock, nextMock, {});

			expect(nextMock).toHaveBeenCalledWith({
				name: VIEWS.SIGNIN,
				query: { redirect: '/' },
			});
		});

		it('should allow navigation if a current user is present', async () => {
			vi.mocked(useUsersStore).mockReturnValue({ currentUser: { id: '123' } } as ReturnType<
				typeof useUsersStore
			>);

			const nextMock = vi.fn();
			const toMock = { query: {} } as RouteLocationNormalized;
			const fromMock = {} as RouteLocationNormalized;

			await authenticatedMiddleware(toMock, fromMock, nextMock, {});

			expect(nextMock).not.toHaveBeenCalled();
		});

		it('should redirect to SAML IdP when SSO is default auth and login button would be shown', async () => {
			vi.mocked(useUsersStore).mockReturnValue({ currentUser: null } as ReturnType<
				typeof useUsersStore
			>);

			const idpUrl = 'https://idp.example/saml';
			const getSSORedirectUrl = vi.fn().mockResolvedValue(idpUrl);
			vi.mocked(useSSOStore).mockReturnValue({
				showSsoLoginButton: true,
				isDefaultAuthenticationSaml: true,
				getSSORedirectUrl,
				oidc: { loginUrl: '' },
			} as unknown as ReturnType<typeof useSSOStore>);

			const locationMock = { href: 'https://app.example.com/workflows' };
			Object.defineProperty(window, 'location', {
				configurable: true,
				value: locationMock,
			});

			const nextMock = vi.fn();
			const toMock = { query: {} } as RouteLocationNormalized;
			const fromMock = {} as RouteLocationNormalized;

			await authenticatedMiddleware(toMock, fromMock, nextMock, {});

			expect(getSSORedirectUrl).toHaveBeenCalled();
			expect(locationMock.href).toBe(idpUrl);
			expect(nextMock).toHaveBeenCalledWith(false);
		});

		it('should redirect to OIDC login URL when OIDC is default auth', async () => {
			vi.mocked(useUsersStore).mockReturnValue({ currentUser: null } as ReturnType<
				typeof useUsersStore
			>);

			const oidcLogin = 'https://oidc.example/authorize';
			vi.mocked(useSSOStore).mockReturnValue({
				showSsoLoginButton: true,
				isDefaultAuthenticationSaml: false,
				getSSORedirectUrl: vi.fn(),
				oidc: { loginUrl: oidcLogin },
			} as unknown as ReturnType<typeof useSSOStore>);

			const locationMock = { href: 'https://app.example.com/workflows' };
			Object.defineProperty(window, 'location', {
				configurable: true,
				value: locationMock,
			});

			const nextMock = vi.fn();
			const toMock = { query: {} } as RouteLocationNormalized;
			const fromMock = {} as RouteLocationNormalized;

			await authenticatedMiddleware(toMock, fromMock, nextMock, {});

			expect(locationMock.href).toBe(oidcLogin);
			expect(nextMock).toHaveBeenCalledWith(false);
		});
	});
});
