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
import { UserAvatar } from '@carbon/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useLogout, useUserProfile, type Authentication } from '../shared/auth/authentication';
import { classicUrl, moduleUrl, type ModuleName } from '../shared/config';
import { displayName } from '../shared/format';
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userName = displayName(profile.data, authentication.userId);

  return (
    <Header aria-label={t('APP_VENDOR')}>
      {/* prefix rendered here: the logo comes before it (Carbon's default prefix is "IBM") */}
      <HeaderName href={moduleUrl(module, engine)} prefix="">
        <img src={logo} alt="" className="cz-header__logo" />
        <span className="cds--header__name--prefix">{t('APP_VENDOR')}</span>&nbsp;{t(`${module.toUpperCase()}_APP`)}
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
        <HeaderGlobalAction
          aria-label={userName}
          aria-expanded={userMenuOpen}
          isActive={userMenuOpen}
          tooltipAlignment="end"
          onClick={() => setUserMenuOpen((open) => !open)}
        >
          <UserAvatar size={20} />
        </HeaderGlobalAction>
      </HeaderGlobalBar>
      <HeaderPanel expanded={userMenuOpen} aria-label={t('USER_MENU')} onHeaderPanelFocus={() => setUserMenuOpen(false)}>
        <p className="cz-user-menu__name">{userName}</p>
        <Switcher aria-label={t('USER_MENU')}>
          <SwitcherItem aria-label={t('SWITCH_TO_CLASSIC_UI')} href={classicUrl(module, engine)}>
            {t('SWITCH_TO_CLASSIC_UI')}
          </SwitcherItem>
          <SwitcherDivider />
          <SwitcherItem aria-label={t('SIGN_OUT_ACTION')} onClick={() => logout.mutate()}>
            {t('SIGN_OUT_ACTION')}
          </SwitcherItem>
        </Switcher>
      </HeaderPanel>
    </Header>
  );
}
