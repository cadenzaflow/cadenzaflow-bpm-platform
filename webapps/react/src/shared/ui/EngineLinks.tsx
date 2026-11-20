import { useTranslation } from 'react-i18next';
import { moduleUrl, type ModuleName } from '../config';

interface EngineLinksProps {
  module: ModuleName;
  /** the engine of the page; it is named, the others are links */
  engine: string;
  engines: string[];
}

/** The process engines of the server as links to the same webapp, where there is no header: on the login page. */
export function EngineLinks({ module, engine, engines }: EngineLinksProps) {
  const { t } = useTranslation();
  return (
    <nav className="cz-engine-links" aria-label={t('PROCESS_ENGINE')}>
      <span>{t('PROCESS_ENGINE')}:</span>
      <ul>
        {engines.map((name) => (
          <li key={name}>
            {name === engine ? (
              <strong aria-current="true">{name}</strong>
            ) : (
              <a className="cds--link" href={moduleUrl(module, name)}>
                {name}
              </a>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
