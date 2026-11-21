import { useState } from 'react';
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  HeaderPanel,
  Switcher,
  SwitcherDivider,
  SwitcherItem,
} from '@carbon/react';
import { DataBase, UserAvatar } from '@carbon/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useLogout, useUserProfile, type Authentication } from '../shared/auth/authentication';
import { useSettings } from '../shared/classic-settings';
import { classicUrl, moduleUrl, type ModuleName } from '../shared/config';
import { useEngines } from '../shared/engines';
import { displayName } from '../shared/format';
import { logOutWith, useLogoutPlugin } from '../shared/plugins/plugins';
import logo from '../assets/cadenzaflow-logo.png';

/** Modules in the header navigation, in the order of the AngularJS app switcher. */
const NAVIGATION: ModuleName[] = ['cockpit', 'tasklist', 'admin'];

interface AppHeaderProps {
  module: ModuleName;
  engine: string;
  authentication: Authentication;
}

export function AppHeader({ module, engine, authentication }: AppHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const profile = useUserProfile(engine, authentication.userId);
  const logout = useLogout(engine);
  const logoutPlugin = useLogoutPlugin(module);
  // one menu at a time: the user's, or the process engines
  const [menu, setMenu] = useState<'user' | 'engines' | null>(null);
  const userMenuOpen = menu === 'user';
  const enginesOpen = menu === 'engines';
  const setUserMenuOpen = (open: boolean) => setMenu(open ? 'user' : null);
  const userName = displayName(profile.data, authentication.userId);
  // as in the AngularJS webapps: the selection is there when the server has more than one engine
  const engines = useEngines().data ?? [];
  const engineLabel = `${t('PROCESS_ENGINE')}: ${engine}`;
  const settings = useSettings(module);
  const vendor = settings.appVendor ?? t('APP_VENDOR');

  // a logout plugin (e.g. single sign-on) replaces the webapp's own logout
  const signOut = () => {
    if (!logoutPlugin || !logOutWith(logoutPlugin, engine)) {
      logout.mutate();
    }
  };

  return (
    <Header aria-label={vendor}>
      {/* prefix rendered here: the logo comes before it (Carbon's default prefix is "IBM") */}
      <HeaderName href={moduleUrl(module, engine)} prefix="">
        <img src={logo} alt="" className="cz-header__logo" />
        <span className="cds--header__name--prefix">{vendor}</span>&nbsp;{settings.appName ?? t(`${module.toUpperCase()}_APP`)}
      </HeaderName>
      <HeaderNavigation aria-label={t('MODULES')}>
        {NAVIGATION.filter((item) => authentication.authorizedApps.includes(item)).map((item) => (
          <HeaderMenuItem
            key={item}
            href={moduleUrl(item, engine)}
            isActive={item === module}
            onClick={(event) => {
              event.preventDefault();
              navigate({ to: `/${item}/$engine`, params: { engine } });
            }}
          >
            {t(`${item.toUpperCase()}_APP`)}
          </HeaderMenuItem>
        ))}
      </HeaderNavigation>
      <HeaderGlobalBar>
        {engines.length > 1 && (
          <button
            type="button"
            className={`cds--header__action cz-header__engine${enginesOpen ? ' cds--header__action--active' : ''}`}
            aria-label={engineLabel}
            aria-expanded={enginesOpen}
            title={t('DIRECTIVE_ENGINE_SELECT_TOOLTIP')}
            onClick={() => setMenu(enginesOpen ? null : 'engines')}
          >
            <DataBase size={20} aria-hidden="true" />
            <span>{engine}</span>
          </button>
        )}
        <HeaderGlobalAction
          aria-label={userName}
          aria-expanded={userMenuOpen}
          isActive={userMenuOpen}
          tooltipAlignment="end"
          onClick={() => setUserMenuOpen(!userMenuOpen)}
        >
          <UserAvatar size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
      {engines.length > 1 && (
        <HeaderPanel expanded={enginesOpen} aria-label={t('PROCESS_ENGINE')} onHeaderPanelFocus={() => setMenu(null)}>
          <p className="cz-user-menu__name">{t('PROCESS_ENGINE')}</p>
          <p className="cz-user-menu__hint">{t('DIRECTIVE_ENGINE_SELECT_TOOLTIP')}</p>
          <Switcher aria-label={t('PROCESS_ENGINE')}>
            {/* another engine has its own login and data: its page is loaded anew, as in the AngularJS webapps */}
            {engines.map((name) => (
              <SwitcherItem
                key={name}
                aria-label={name}
                href={moduleUrl(module, name)}
                isSelected={name === engine}
                aria-current={name === engine ? 'true' : undefined}
              >
                {name}
              </SwitcherItem>
            ))}
          </Switcher>
        </HeaderPanel>
      )}
      <HeaderPanel expanded={userMenuOpen} aria-label={t('USER_MENU')} onHeaderPanelFocus={() => setUserMenuOpen(false)}>
        <p className="cz-user-menu__name">{userName}</p>
        <Switcher aria-label={t('USER_MENU')}>
          {module !== 'welcome' && authentication.authorizedApps.includes('welcome') && (
            <SwitcherItem
              aria-label={t('MY_PROFILE')}
              href={moduleUrl('welcome', engine)}
              onClick={(event) => {
                event.preventDefault();
                setUserMenuOpen(false);
                navigate({ to: '/welcome/$engine', params: { engine } });
              }}
            >
              {t('MY_PROFILE')}
            </SwitcherItem>
          )}
          <SwitcherItem aria-label={t('SWITCH_TO_CLASSIC_UI')} href={classicUrl(module, engine)}>
            {t('SWITCH_TO_CLASSIC_UI')}
          </SwitcherItem>
          <SwitcherDivider />
          <SwitcherItem aria-label={t('SIGN_OUT_ACTION')} onClick={signOut}>
            {t('SIGN_OUT_ACTION')}
          </SwitcherItem>
        </Switcher>
      </HeaderPanel>
    </Header>
  );
}
