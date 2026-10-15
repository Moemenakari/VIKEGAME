/**
 * Realms (servers). Every realm is a copy of Midgard with its own King, chosen at
 * the Midsummer Thing (GDD §10). Until players take the throne, each realm is held
 * by a king from the sagas and chronicles (see HISTORY_BIBLE.md).
 */
export interface RealmDef {
  id: number;
  name: string;
  /** The reigning king of the realm (an AI king until a player wins the Thing). */
  king: string;
  kingSource: string;
}

export const REALMS: readonly RealmDef[] = [
  { id: 1, name: 'Uppsala', king: 'Eiríkr the Victorious', kingSource: 'Adam of Bremen; Heimskringla' },
  { id: 2, name: 'Jelling', king: 'Haraldr Bluetooth', kingSource: 'Jelling stones; Heimskringla' },
  { id: 3, name: 'Hlaðir', king: 'Hákon Jarl', kingSource: 'Heimskringla; Jómsvíkinga saga' },
  { id: 4, name: 'Dyflin', king: 'Óláfr Cuarán', kingSource: 'Annals of Ulster; Irish annals' },
];

/** The realm this hold belongs to (one realm for now; chosen at sign-up once accounts exist). */
export function homeRealm(): RealmDef {
  return REALMS[0]!;
}
