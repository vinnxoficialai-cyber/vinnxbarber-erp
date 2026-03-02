import { calculateEventLayout } from './agendaLayout';

// Mock event structure
const createEvent = (id: string, start: string, end: string, title: string) => ({
    id,
    startTime: start,
    endTime: end,
    title,
    // Required fields for type, but unused in algo
    date: 1, month: 1, year: 2024, type: 'meeting' as any, color: ''
});

const runTest = (name: string, events: any[]) => {
    console.log(`\nRunning Test: ${name}`);
    const layout = calculateEventLayout(events);

    events.forEach(ev => {
        const l = layout.get(ev.id);
        console.log(`Event ${ev.id} (${ev.startTime}-${ev.endTime}): left=${l?.left}, width=${l?.width}`);
    });
};

// Test Case 1: Simple Overlap (Side-by-Side)
runTest('Simple Overlap', [
    createEvent('A', '09:00', '10:00', 'Event A'),
    createEvent('B', '09:00', '10:00', 'Event B')
]);

// Test Case 2: Partial Overlap
runTest('Partial Overlap', [
    createEvent('A', '09:00', '10:00', 'Event A'),
    createEvent('B', '09:30', '10:30', 'Event B')
]);

// Test Case 3: Triple Overlap
runTest('Triple Overlap', [
    createEvent('A', '09:00', '10:00', 'Event A'),
    createEvent('B', '09:15', '10:15', 'Event B'),
    createEvent('C', '09:30', '10:30', 'Event C')
]);

// Test Case 4: Non-Overlapping
runTest('No Overlap', [
    createEvent('A', '09:00', '10:00', 'Event A'),
    createEvent('B', '10:00', '11:00', 'Event B')
]);

// Test Case 5: Complex Cascade
// A: 09:00 - 11:00
// B: 09:30 - 10:30
// C: 10:00 - 12:00
runTest('Complex Cascade', [
    createEvent('A', '09:00', '11:00', 'Long Event A'),
    createEvent('B', '09:30', '10:30', 'Short Middle B'),
    createEvent('C', '10:00', '12:00', 'Long Late C')
]);
