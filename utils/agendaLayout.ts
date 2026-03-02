import { CalendarEvent } from '../types';

export interface EventLayout {
    left: string;
    width: string;
}

// Minimal event interface for testing
interface TestEvent {
    id: string;
    startTime: string;
    endTime: string;
}

const getMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// Check if two events overlap
const checkCollision = (a: TestEvent, b: TestEvent) => {
    const startA = getMinutes(a.startTime);
    const endA = getMinutes(a.endTime);
    const startB = getMinutes(b.startTime);
    const endB = getMinutes(b.endTime);

    return startA < endB && startB < endA;
};

/**
 * Calculates layout for overlapping events using a column packing algorithm.
 * Events that overlap will share the available width.
 */
export const calculateEventLayout = (events: CalendarEvent[]): Map<string, EventLayout> => {
    if (!events.length) return new Map();

    // 1. Sort events by start time, then by length (longer events first)
    const sorted = [...events].sort((a, b) => {
        const startDiff = getMinutes(a.startTime) - getMinutes(b.startTime);
        if (startDiff !== 0) return startDiff;
        return getMinutes(b.endTime) - getMinutes(a.endTime);
    });

    // 2. Assign Columns
    // columns[i] holds array of events in visual column i
    const columns: TestEvent[][] = [];
    const eventColIndex = new Map<string, number>();

    sorted.forEach(ev => {
        let colIndex = 0;
        while (true) {
            const col = columns[colIndex] || [];
            const hasCollision = col.some(other => checkCollision(ev, other));

            if (!hasCollision) {
                if (!columns[colIndex]) {
                    columns[colIndex] = [];
                }
                columns[colIndex].push(ev);
                eventColIndex.set(ev.id, colIndex);
                break;
            }
            colIndex++;
        }
    });

    // 3. Calculate Geometry
    // For each group of overlapping events, find maximum column index used.
    // The available width is split by (maxColumn + 1).
    const layout = new Map<string, EventLayout>();

    sorted.forEach(ev => {
        // A simplified approach:
        // Just use the assigned column index and total number of columns needed for the *connected group* of events.
        // However, calculating connected components is complex.
        // A heuristic: check all events that THIS event collides with.
        // Find the maximum column index among them.

        // Find all events that overlap with current event
        const overlapping = sorted.filter(other => checkCollision(ev, other));

        // Find the max column index used by any of these overlapping events
        let maxCol = 0;
        overlapping.forEach(o => {
            const col = eventColIndex.get(o.id) || 0;
            if (col > maxCol) maxCol = col;
        });

        const colIndex = eventColIndex.get(ev.id) || 0;
        const numCols = maxCol + 1; // Width divisor

        // Example: if maxCol is 1 (cols 0 and 1 exist), width is 50%.
        // If I am in col 0, left is 0%.
        // If I am in col 1, left is 50%.

        layout.set(ev.id, {
            left: `${(colIndex / numCols) * 100}%`,
            width: `${100 / numCols}%`
        });
    });

    return layout;
};
