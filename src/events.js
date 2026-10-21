// The event picker at the top of Scout and Teams, like Inventory's inventory picker: All events, or one event, whose
// matches are then the only ones listed and averaged. The choice is saved on this device.
import { esc, wireMenu, ICON_TROPHY, ICON_CHEVRON } from './ui.js';

const EVENT_KEY = 'ftc-scout-event';

// Event names are typed, so they match whatever their case and spacing.
export const eventKey = (event) => event.trim().toLowerCase().replace(/\s+/g, ' ');

// The team's events as { key, name }, by name. The name shown is the one first typed.
const eventsOf = (matches) => [...new Map(matches.filter((m) => m.event).map((m) => [eventKey(m.event), m.event])).entries()]
  .map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));

// The chosen event's key, or '' for all events. An event whose matches are all deleted is no longer chosen.
export function chosenEvent(matches) {
  const key = localStorage.getItem(EVENT_KEY) ?? '';
  return eventsOf(matches).some((e) => e.key === key) ? key : '';
}

// Whether a match record belongs to the chosen event.
export const inChosenEvent = (record, matches) => {
  const key = chosenEvent(matches);
  return !key || eventKey(record.event) === key;
};

export const eventPickerHtml = () => `
  <div class="eventpick menuwrap">
    <button id="event" class="secondary" aria-haspopup="true" aria-expanded="false" aria-controls="event-menu"></button>
    <div id="event-menu" class="menu" hidden></div>
  </div>`;

// Opens the picker's menu, and calls onChange() after an event is chosen. Once per screen.
export function wireEventPicker(root, onChange) {
  const menu = root.querySelector('#event-menu');
  const show = wireMenu(root.querySelector('#event'), menu);
  menu.onclick = (e) => {
    const item = e.target.closest('[data-key]');
    if (!item) return;
    show(false);
    localStorage.setItem(EVENT_KEY, item.dataset.key);
    onChange();
  };
}

// Shows the chosen event on the picker and the team's events in its menu.
export function fillEventPicker(root, matches) {
  const events = eventsOf(matches);
  const key = chosenEvent(matches);
  root.querySelector('#event').innerHTML = `${ICON_TROPHY}<span>${esc(events.find((e) => e.key === key)?.name ?? 'All events')}</span>${ICON_CHEVRON}`;
  root.querySelector('#event-menu').innerHTML = [{ key: '', name: 'All events' }, ...events].map((e) =>
    `<button class="menu-item" data-key="${esc(e.key)}" ${e.key === key ? 'aria-current="true"' : ''}>${esc(e.name)}</button>`).join('');
}
