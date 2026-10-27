import type { Department, Unit } from '@sim/shared';
import { DEPARTMENTS } from '@sim/shared';
import { useStore } from '../state/store.js';
import { Panel } from './Panel.js';
import { DEPARTMENT_COLOR } from '../map/layers/units.js';

const LABEL: Record<Department, string> = {
  FIRE: 'Fire',
  MEDICAL: 'Medical',
  POLICE: 'Police',
};

interface Availability {
  department: Department;
  available: number;
  total: number;
}

function availability(units: Unit[]): Availability[] {
  return DEPARTMENTS.map((department) => {
    const owned = units.filter((u) => u.department === department);
    return {
      department,
      available: owned.filter((u) => u.status === 'AVAILABLE').length,
      total: owned.length,
    };
  });
}

export function ResourceBoard(): React.JSX.Element {
  const units = useStore((s) => s.world?.units);
  const rows = availability(Object.values(units ?? {}));

  return (
    <Panel title="Resources">
      <ul className="resources">
        {rows.map(({ department, available, total }) => {
          const free = total === 0 ? 0 : available / total;
          // Scarcity has to be felt, not read. The bar goes red before the
          // numbers do, and the numbers are there for anyone who cannot see it.
          const strained = free <= 0.34;
          return (
            <li key={department} className="resource">
              <span className="resource-name">{LABEL[department]}</span>
              <span
                className={`resource-bar${strained ? ' strained' : ''}`}
                role="img"
                aria-label={`${LABEL[department]}: ${available} of ${total} units available`}
              >
                {Array.from({ length: total }, (_, i) => (
                  <i
                    key={i}
                    className={i < available ? 'pip free' : 'pip busy'}
                    style={i < available ? { background: DEPARTMENT_COLOR[department] } : undefined}
                  />
                ))}
              </span>
              <span className="resource-count">
                {available}/{total}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
