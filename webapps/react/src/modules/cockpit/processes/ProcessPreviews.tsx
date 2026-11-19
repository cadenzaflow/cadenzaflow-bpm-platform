import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { SkeletonPlaceholder } from '@carbon/react';
import { WarningFilled } from '@carbon/icons-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useProcessDefinitionXml } from '../process-definition/api';
import type { ProcessDefinitionOverview } from './ProcessesPage';

const BpmnDiagram = lazy(() => import('../../../shared/diagram/BpmnDiagram'));

/** The diagram of a definition, loaded once its tile comes into view. */
function DiagramPreview({ engine, id }: { engine: string; id: string }) {
  const frame = useRef<HTMLDivElement>(null);
  // without the observer (an old browser) every preview loads at once
  const [inView, setInView] = useState(typeof IntersectionObserver === 'undefined');
  const xml = useProcessDefinitionXml(engine, inView ? id : undefined);

  useEffect(() => {
    if (inView || !frame.current) {
      return;
    }
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setInView(true), { rootMargin: '200px' });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <div ref={frame} className="cz-process-tile__diagram" aria-hidden="true">
      {xml.data ? (
        <Suspense fallback={<SkeletonPlaceholder className="cz-process-tile__skeleton" />}>
          <BpmnDiagram xml={xml.data} />
        </Suspense>
      ) : (
        !xml.isError && <SkeletonPlaceholder className="cz-process-tile__skeleton" />
      )}
    </div>
  );
}

/** The process definitions as tiles with their diagrams (the "Previews" of the classic Cockpit). */
export function ProcessPreviews({ engine, definitions }: { engine: string; definitions: ProcessDefinitionOverview[] }) {
  const { t } = useTranslation('cockpit');
  return (
    <ul className="cz-process-tiles">
      {definitions.map((definition) => (
        <li key={definition.id} className="cz-process-tile">
          <h3 className="cz-process-tile__name">
            <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: definition.id }}>
              {definition.name || definition.key}
            </Link>
          </h3>
          <DiagramPreview engine={engine} id={definition.id} />
          <p className="cz-process-tile__counts">
            {definition.incidents > 0 && (
              <span className="cz-incident-count" title={t('PLUGIN_PROCESS_DEF_INCIDENTS')}>
                <WarningFilled aria-label={t('PLUGIN_PROCESS_DEF_INCIDENTS')} />
                {definition.incidents.toLocaleString()}
              </span>
            )}
            <span>
              {definition.instances.toLocaleString()} {t('PLUGIN_PROCESS_DEF_RUNNING_INSTANCES')}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
