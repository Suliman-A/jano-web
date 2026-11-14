/**
 * @fileoverview A Temple's detail: what it offers, and its free slots.
 */

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { request } from '@/api/client';
import { Endpoint } from '@/api/endpoints';
import { boothFunctions, booths, patient } from '@/api/mock/seed';
import { Button } from '@/components/atoms/Button';
import { Card } from '@/components/atoms/Card';
import { Chip } from '@/components/atoms/Chip';
import { Screen } from '@/components/atoms/Screen';
import { AsyncState } from '@/components/molecules/AsyncState';
import { isBookable } from '@/core/booths';
import type { Slot } from '@/core/types';
import styles from '@/features/temple/BoothDetail.module.css';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { useQueryOnce } from '@/hooks/useQueryOnce';
import { BackLink } from '@/navigation/BackLink';
import { routes } from '@/navigation/routes';

/**
 * Formats a slot as a day and time.
 * @param at - Epoch milliseconds.
 * @returns {string} - A label such as `Fri 11:30 AM`.
 */
const toSlotLabel = (at: number): string =>
  new Date(at).toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    weekday: 'short',
  });

/**
 * The booth detail screen.
 * @returns {React.JSX.Element} - The screen.
 */
export const BoothDetailScreen = (): React.JSX.Element => {
  const { boothId = '' } = useParams();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const booth = booths.find((candidate) => candidate.id === boothId);

  const slotsQuery = useQueryOnce<Slot[]>(
    () => request(Endpoint.Slots, { boothId }),
    [boothId],
  );

  const booking = useAsyncAction(async (slotId: string) =>
    request(Endpoint.Book, { patientId: patient.id, slotId }),
  );

  const available = (slotsQuery.data ?? []).filter((slot) => slot.isAvailable);

  /**
   * Books the chosen slot and shows the resulting pass.
   */
  const confirm = async (): Promise<void> => {
    if (!selectedId) {
      return;
    }

    const result = await booking.run(selectedId);

    if (result) {
      navigate(routes.pass);
    }
  };

  if (!booth) {
    return (
      <Screen>
        <BackLink fallback={routes.temple} text="Temple" />
        <h1 className="t-screen-title">Temple not found</h1>
      </Screen>
    );
  }

  return (
    <Screen data-testid="booth-detail-screen">
      <BackLink fallback={routes.temple} text="Temple" />

      <h1 className="t-screen-title">{booth.name}</h1>
      <p className="t-caption c-muted">
        {booth.area} · {booth.hours}
      </p>

      <div className={styles.tags}>
        {booth.functions.map((fn) => (
          <Chip key={fn} text={boothFunctions[fn]} tone="brand" />
        ))}
        {!isBookable(booth) ? (
          <Chip text="Closed for maintenance" tone="warning" />
        ) : null}
      </div>

      <h2 className="t-section-title">Pick a time</h2>

      <AsyncState
        emptyMessage={
          isBookable(booth)
            ? 'Every slot here is taken. Try another Temple.'
            : 'This Temple is closed for maintenance.'
        }
        emptyTitle="No times available"
        error={slotsQuery.error}
        isEmpty={available.length === 0}
        isLoading={slotsQuery.isLoading}
        loadingText="Checking availability…"
        onRetry={slotsQuery.refetch}
      />

      <div className={styles.slots}>
        {available.slice(0, 12).map((slot) => {
          const isSelected = slot.id === selectedId;

          return (
            <button
              aria-pressed={isSelected}
              className={`${styles.slot} ${isSelected ? styles.slotSelected : ''}`}
              data-testid={`slot-${slot.id}`}
              key={slot.id}
              onClick={() => setSelectedId(slot.id)}
              type="button"
            >
              {toSlotLabel(slot.startsAt)}
            </button>
          );
        })}
      </div>

      {booking.error ? (
        <Card className={styles.error}>
          <p className="t-caption c-danger">{booking.error.message}</p>
        </Card>
      ) : null}

      {available.length > 0 ? (
        <Button
          disabled={!selectedId}
          isLoading={booking.isLoading}
          onClick={confirm}
          text="Book this visit"
        />
      ) : null}
    </Screen>
  );
};
