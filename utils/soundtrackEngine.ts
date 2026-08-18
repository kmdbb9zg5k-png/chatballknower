import { SOUNDTRACK_TRACKS } from '../soundtrackEngine';

const sunoAudio = (id: string) => `https://cdn1.suno.ai/${id}.mp3`;

const newTracks = [
  {
    id: 'boots-stay-clean',
    title: 'Boots Stay Clean',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 100,
    mood: 'Undefeated',
    durationSec: 175,
    audioUrl: sunoAudio('0d599a59-bdfd-4e8c-bee2-ac35f7cb87d7'),
  },
  {
    id: 'cant-break-me',
    title: 'Can’t Break Me',
    subtitle: 'elifromthesouth • Original Ball Knower Track',
    tempoBpm: 100,
    mood: 'Unbreakable',
    durationSec: 152,
    audioUrl: sunoAudio('8f1c1f2a-c8ff-46e4-b357-cf894688e3eb'),
  },
];

for (const track of newTracks) {
  if (!SOUNDTRACK_TRACKS.some(existing => existing.id === track.id)) {
    SOUNDTRACK_TRACKS.push(track);
  }
}

export * from '../soundtrackEngine';
