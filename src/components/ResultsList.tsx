import { useState } from 'react';
import type { ActivityResult } from '../domain/types';
import { t } from '../i18n';
import { ActivityCard } from './ActivityCard';

const PAGE = 24;

interface Props {
  results: ActivityResult[];
  familySize: number;
  onOpen: (id: string) => void;
}

export function ResultsList({ results, familySize, onOpen }: Props) {
  const [shown, setShown] = useState(PAGE);
  const [prevResults, setPrevResults] = useState(results);
  if (results !== prevResults) {
    setPrevResults(results);
    setShown(PAGE);
  }

  if (results.length === 0) {
    return (
      <div className="empty" role="status">
        <p>
          <strong>{t.noResults}</strong>
        </p>
        <p>{t.noResultsHint}</p>
      </div>
    );
  }
  return (
    <>
      <ul className="cards">
        {results.slice(0, shown).map((r) => (
          <ActivityCard key={r.activity.id} result={r} familySize={familySize} onOpen={onOpen} />
        ))}
      </ul>
      {shown < results.length && (
        <button type="button" className="btn" onClick={() => setShown((s) => s + PAGE)}>
          {t.loadMore}
        </button>
      )}
    </>
  );
}
