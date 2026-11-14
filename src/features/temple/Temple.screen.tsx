/**
 * @fileoverview Find a Temple: the pass at the top, then search, filters, and
 * the booths as either a map or a list.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { boothFunctions, booths } from '@/api/mock/seed';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { Icon } from '@/components/atoms/Icon';
import { Screen } from '@/components/atoms/Screen';
import { EmptyState } from '@/components/molecules/EmptyState';
import { filterBooths, hasLocation } from '@/core/booths';
import type { Booth, BoothFunctionKey } from '@/core/types';
import { PassCard } from '@/features/pass/PassCard';
import { BoothMap } from '@/features/temple/BoothMap';
import styles from '@/features/temple/Temple.module.css';
import { routes } from '@/navigation/routes';

const FUNCTION_KEYS = Object.keys(boothFunctions) as BoothFunctionKey[];

/**
 * One booth in the list.
 * @param props - The booth and what happens when it is tapped.
 * @returns {React.JSX.Element} - The row.
 */
const BoothRow = ({
  booth,
  onClick,
}: {
  booth: Booth;
  onClick: () => void;
}): React.JSX.Element => (
  <Card className={styles.row} onClick={onClick}>
    <span className={styles.rowIcon}>
      <Icon name="temple" size={20} />
    </span>
    <span className={styles.rowBody}>
      <span className="t-label">{booth.name}</span>
      <span className="t-caption c-muted">
        {booth.area} ·{' '}
        {booth.functions.map((fn) => boothFunctions[fn]).join(', ')}
      </span>
      {!hasLocation(booth) ? (
        <span className="t-caption c-muted">Location coming soon</span>
      ) : null}
    </span>
    {booth.status === 'maintenance' ? (
      <Chip text="Maintenance" tone="warning" />
    ) : (
      <Icon color="var(--c-muted)" name="chevron" size={20} />
    )}
  </Card>
);

/**
 * The Temple screen.
 * @returns {React.JSX.Element} - The screen.
 */
export const TempleScreen = (): React.JSX.Element => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BoothFunctionKey[]>([]);
  const [isMap, setIsMap] = useState(true);

  const visible = filterBooths(booths, query, selected);

  /**
   * Adds or removes a function filter.
   * @param key - The function tapped.
   */
  const toggleFunction = (key: BoothFunctionKey): void => {
    setSelected((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key],
    );
  };

  return (
    <Screen data-testid="temple-screen">
      <PassCard />

      <h1 className="t-screen-title">Find a Jano Temple</h1>
      <p className="t-caption c-muted">
        <Icon name="pin" size={14} /> Metro Manila
      </p>

      <div className={styles.search}>
        <Icon name="search" size={18} />
        <input
          aria-label="Search by area"
          className={styles.searchInput}
          data-testid="booth-search"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by area"
          type="search"
          value={query}
        />
      </div>

      <div className={styles.filters}>
        {FUNCTION_KEYS.map((key) => (
          <Chip
            className={styles.filter}
            isSelected={selected.includes(key)}
            key={key}
            onClick={() => toggleFunction(key)}
            text={boothFunctions[key]}
          />
        ))}
      </div>

      <div className={styles.toggle} role="group" aria-label="How to show them">
        <button
          aria-pressed={isMap}
          className={`${styles.toggleItem} ${isMap ? styles.toggleItemActive : ''}`}
          onClick={() => setIsMap(true)}
          type="button"
        >
          <Icon name="map" size={16} /> Map
        </button>
        <button
          aria-pressed={!isMap}
          className={`${styles.toggleItem} ${isMap ? '' : styles.toggleItemActive}`}
          onClick={() => setIsMap(false)}
          type="button"
        >
          <Icon name="list" size={16} /> List
        </button>
      </div>

      {isMap ? (
        <BoothMap
          booths={visible}
          onSelect={(boothId) => navigate(routes.boothDetail(boothId))}
        />
      ) : null}

      {visible.length === 0 ? (
        <EmptyState
          message="Try a different area or clear the filters."
          title="No Temples match"
        />
      ) : (
        <div className={styles.list}>
          {visible.map((booth) => (
            <BoothRow
              booth={booth}
              key={booth.id}
              onClick={() => navigate(routes.boothDetail(booth.id))}
            />
          ))}
        </div>
      )}

      <button
        className={styles.simulatorLink}
        data-testid="open-booth-simulator"
        onClick={() => navigate(routes.boothSimulator)}
        type="button"
      >
        Open the Booth simulator →
      </button>
    </Screen>
  );
};
