import {
  HEROES,
  HERO_RULES,
  heroMaxLevel,
  type GameState,
  type HeroDef,
  type HeroSkill,
} from '@jarlheim/sim';
import { useEffect, useState } from 'react';
import type { GameStore } from '../game/store';
import { formatAmount } from './format';
import { t } from './i18n';
import { HeroPortrait, ResourceIcon, TroopTypeIcon } from './icons';
import { HelpTip } from './help';

/** What a skill does, in the player's language. */
export function skillText(skill: HeroSkill): string {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  switch (skill.kind) {
    case 'wallGuard':
      return t('sk_wallGuard', { p: pct(skill.reduce), r: skill.rounds });
    case 'allAttack':
      return t('sk_allAttack', { p: pct(skill.bonus) });
    case 'curse':
      return t('sk_curse', { p: pct(skill.reduce) });
    case 'typeAttack':
      return t('sk_typeAttack', { p: pct(skill.bonus), u: t(`unit_${skill.type}`) });
    case 'volley':
      return t('sk_volley', { m: skill.multiplier, r: skill.round, u: t(`unit_${skill.type}`) });
    case 'draugrBane':
      return t('sk_draugrBane', { p: pct(skill.bonus) });
    case 'fearless':
      return t('sk_fearless', { p: pct(skill.bonus) });
    case 'production':
      return t('sk_production', { p: pct(skill.bonus) });
    case 'land':
      return t('sk_land', { p: pct(skill.bonus) });
    case 'defend':
      return t('sk_defend', { p: pct(skill.reduce) });
  }
}

const Stars = ({ n }: { n: number }) => (
  <span className="stars" aria-label={`${n}★`}>
    {'★'.repeat(n)}
    <span className="off">{'★'.repeat(HERO_RULES.maxStars - n)}</span>
  </span>
);

export function HeroesPanel({
  store,
  state,
  onClose,
  onError,
}: {
  store: GameStore;
  state: GameState;
  onClose: () => void;
  onError: (m: string) => void;
}) {
  const [tab, setTab] = useState<'heroes' | 'recruit'>('heroes');
  const [pick, setPick] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string[]>([]);
  const run = (cmd: Parameters<GameStore['dispatch']>[0]) => {
    const err = store.dispatch(cmd);
    if (err) onError(err.message);
    return !err;
  };
  const owned = HEROES.filter((h) => state.heroes.owned[h.id]);
  const squad = state.heroes.squad;
  const hero = pick ? HEROES.find((h) => h.id === pick) : undefined;

  // Show who was drawn: the recruit command reports them in its event.
  useEffect(
    () =>
      store.onEvents((events) => {
        for (const e of events) if (e.type === 'heroes.recruited') setDrawn(e.heroes);
      }),
    [store],
  );
  const recruit = (count: 1 | 10, gold = false) => {
    run({ type: 'recruitHero', count, gold });
  };

  return (
    <section className="card panel heroes-panel" data-testid="heroes" role="dialog" aria-label={t('heroes')}>
      <button className="close" onClick={onClose} aria-label={t('close')}>
        ×
      </button>
      <div className="tabs" role="tablist">
        {(['heroes', 'recruit'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? 'active' : ''}
            onClick={() => setTab(k)}
            data-testid={`heroes-tab-${k}`}
          >
            {k === 'heroes' ? t('heroes') : t('recruit')}
          </button>
        ))}
      </div>
      <HelpTip key={tab} id={tab} state={state} />

      {tab === 'heroes' && !hero && (
        <>
          <h3>{t('squad')}</h3>
          <div className="squad">
            {Array.from({ length: HERO_RULES.squadSize }, (_, i) => {
              const h = HEROES.find((x) => x.id === squad[i]);
              return (
                <button
                  key={i}
                  className="hero-slot"
                  onClick={() => h && setPick(h.id)}
                  data-testid={`squad-${i}`}
                >
                  {h ? (
                    <HeroPortrait look={h.look} rarity={h.rarity} size={60} />
                  ) : (
                    <span className="empty">+</span>
                  )}
                  <small>{h?.name.split(' ')[0] ?? ''}</small>
                </button>
              );
            })}
          </div>
          <h3>
            {t('heroes')} · {owned.length}/{HEROES.length}
          </h3>
          <div className="hero-grid">
            {HEROES.map((h) => {
              const o = state.heroes.owned[h.id];
              return (
                <button
                  key={h.id}
                  className={`hero-card ${o ? '' : 'locked'} ${squad.includes(h.id) ? 'in-squad' : ''}`}
                  onClick={() => setPick(h.id)}
                  data-testid={`hero-${h.id}`}
                >
                  <HeroPortrait look={h.look} rarity={h.rarity} size={52} />
                  <small className="hero-name">{h.name.split(',')[0]}</small>
                  {o ? (
                    <small>
                      Lv {o.level} <Stars n={o.stars} />
                    </small>
                  ) : (
                    <small className="muted">🔒</small>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === 'heroes' && hero && (
        <HeroDetail state={state} hero={hero} run={run} onBack={() => setPick(null)} />
      )}

      {tab === 'recruit' && (
        <div className="recruit" data-testid="recruit">
          <p className="horns">
            📯 {t('horns')}: <b data-testid="horns">{state.heroes.horns}</b>
          </p>
          <ul className="odds">
            <li className="legendary">
              {t('rarity_legendary')} {Math.round(HERO_RULES.odds.legendary * 100)}%
            </li>
            <li className="epic">
              {t('rarity_epic')} {Math.round(HERO_RULES.odds.epic * 100)}%
            </li>
            <li className="rare">
              {t('rarity_rare')} {Math.round(HERO_RULES.odds.rare * 100)}%
            </li>
          </ul>
          <p className="muted">
            {t('pityEpic', { n: HERO_RULES.epicPity - state.heroes.pity.epic })} ·{' '}
            {t('pityLegendary', { n: HERO_RULES.legendaryPity - state.heroes.pity.legendary })}
          </p>
          <div className="recruit-buttons">
            <button className="primary" onClick={() => recruit(1)} data-testid="recruit-1">
              📯 ×1
            </button>
            <button className="primary" onClick={() => recruit(10)} data-testid="recruit-10">
              📯 ×10
            </button>
            <button className="secondary" onClick={() => recruit(1, true)} data-testid="recruit-gold">
              <ResourceIcon res="gold" size={14} /> {HERO_RULES.goldPerRecruit} ×1
            </button>
          </div>
          <p className="muted">{t('hornsHow')}</p>
          {drawn.length > 0 && (
            <div className="drawn" data-testid="drawn">
              {drawn.map((id, i) => {
                const h = HEROES.find((x) => x.id === id)!;
                return (
                  <div key={i} className={`drawn-hero ${h.rarity}`}>
                    <HeroPortrait look={h.look} rarity={h.rarity} size={48} />
                    <small>{h.name.split(' ')[0]}</small>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function HeroDetail({
  state,
  hero,
  run,
  onBack,
}: {
  state: GameState;
  hero: HeroDef;
  run: (cmd: Parameters<GameStore['dispatch']>[0]) => boolean;
  onBack: () => void;
}) {
  const o = state.heroes.owned[hero.id];
  const inSquad = state.heroes.squad.includes(hero.id);
  const max = heroMaxLevel(state);
  const cost = o ? HERO_RULES.levelCost(o.level) : 0;
  return (
    <div className="hero-detail" data-testid="hero-detail">
      <button className="link" onClick={onBack}>
        ← {t('back')}
      </button>
      <div className="hero-head">
        <HeroPortrait look={hero.look} rarity={hero.rarity} size={84} />
        <div>
          <h2>{hero.name}</h2>
          <p className={`rarity ${hero.rarity}`}>{t(`rarity_${hero.rarity}`)}</p>
          {o && (
            <p>
              Lv {o.level}/{max} <Stars n={o.stars} />
            </p>
          )}
        </div>
      </div>
      <p className="stat">
        {hero.troop === 'support' ? '✦' : <TroopTypeIcon type={hero.troop} size={16} />}{' '}
        {t(`unit_${hero.troop}`)}
      </p>
      <p>⚡ {skillText(hero.skill)}</p>
      <p className="norse">📜 {hero.source}</p>
      {o ? (
        <>
          <button
            className="primary"
            disabled={o.level >= max}
            onClick={() => run({ type: 'levelHero', heroId: hero.id })}
            data-testid="hero-level"
          >
            ⬆ {o.level >= max ? t('heroMax') : t('levelUp')} · <ResourceIcon res="silver" size={14} />{' '}
            {formatAmount(cost)}
          </button>
          <button
            className="secondary"
            onClick={() =>
              run({
                type: 'setSquad',
                squad: inSquad
                  ? state.heroes.squad.filter((x) => x !== hero.id)
                  : [...state.heroes.squad, hero.id].slice(-HERO_RULES.squadSize),
              })
            }
            data-testid="hero-squad"
          >
            {inSquad ? `− ${t('leaveSquad')}` : `+ ${t('joinSquad')}`}
          </button>
        </>
      ) : (
        <p className="muted">🔒 {t('recruitToUnlock')}</p>
      )}
    </div>
  );
}
