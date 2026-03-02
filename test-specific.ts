// Test specific operations that user reported as broken
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function testBirthdayUpdate() {
    console.log('\n=== TESTING BIRTHDAY UPDATE ===\n');

    // Get first team member
    const { data: members, error: readError } = await supabase
        .from('team_members')
        .select('*')
        .limit(1);

    if (readError || !members || members.length === 0) {
        console.log('❌ No team members found or error:', readError?.message);
        return false;
    }

    const member = members[0];
    console.log('Found member:', member.userId);
    console.log('Current birthDate:', member.birthDate);

    // Try to update birthDate
    const testDate = '1990-01-15';
    const { error: updateError, data: updated } = await supabase
        .from('team_members')
        .update({
            birthDate: testDate,
            updatedAt: new Date().toISOString()
        })
        .eq('userId', member.userId)
        .select();

    if (updateError) {
        console.log('❌ Failed to update birthday:', updateError.message);
        return false;
    }

    if (!updated || updated.length === 0) {
        console.log('❌ Update returned no data (possible RLS issue)');
        return false;
    }

    console.log('✅ Birthday updated successfully!');
    console.log('New birthDate:', updated[0].birthDate);
    return true;
}

async function testTaskCreation() {
    console.log('\n=== TESTING TASK CREATION ===\n');

    const { data, error } = await supabase
        .from('personal_tasks')
        .insert({
            text: 'Test task from script',
            scope: 'day',
            completed: false,
            assigneeId: 'test-user-123'
        })
        .select()
        .single();

    if (error) {
        console.log('❌ Failed to create task:', error.message);
        return false;
    }

    console.log('✅ Task created successfully! ID:', data.id);

    // Clean up
    await supabase.from('personal_tasks').delete().eq('id', data.id);
    console.log('✅ Task deleted (cleanup)');
    return true;
}

async function testCalendarEventCreation() {
    console.log('\n=== TESTING CALENDAR EVENT CREATION ===\n');

    const { randomUUID } = await import('crypto');

    const { data, error } = await supabase
        .from('calendar_events')
        .insert({
            id: randomUUID(),
            title: 'Test Event',
            type: 'MEETING',
            startTime: '09:00',
            endTime: '10:00',
            date: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.log('❌ Failed to create calendar event:', error.message);
        return false;
    }

    console.log('✅ Calendar event created successfully! ID:', data.id);

    // Clean up
    await supabase.from('calendar_events').delete().eq('id', data.id);
    console.log('✅ Event deleted (cleanup)');
    return true;
}

async function runAllTests() {
    let passed = 0;
    let total = 3;

    if (await testBirthdayUpdate()) passed++;
    if (await testTaskCreation()) passed++;
    if (await testCalendarEventCreation()) passed++;

    console.log(`\n=== FINAL RESULT: ${passed}/${total} passed ===\n`);
    process.exit(passed === total ? 0 : 1);
}

runAllTests();
