// Test birthday save and load flow
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!
);

async function testBirthdayFlow() {
    console.log('\n=== BIRTHDAY SAVE/LOAD FLOW TEST ===\n');

    // 1. Get a team member
    const { data: members, error: fetchError } = await supabase
        .from('team_members')
        .select('*')
        .limit(1);

    if (fetchError || !members || members.length === 0) {
        console.log('❌ No team members found:', fetchError?.message);
        return;
    }

    const member = members[0];
    console.log('📋 Current team member data:');
    console.log(JSON.stringify(member, null, 2));

    // 2. Check what columns exist
    console.log('\n📊 Looking for birthday-related columns:');
    const birthdayColumns = Object.keys(member).filter(k =>
        k.toLowerCase().includes('birth') || k.toLowerCase().includes('date')
    );
    console.log('Found columns:', birthdayColumns);

    // 3. Try updating with a test birthday
    const testBirthday = '1995-06-15';
    console.log(`\n🔄 Updating birthDate to: ${testBirthday}`);

    const { data: updateResult, error: updateError } = await supabase
        .from('team_members')
        .update({
            birthDate: testBirthday,
            updatedAt: new Date().toISOString()
        })
        .eq('userId', member.userId)
        .select();

    if (updateError) {
        console.log('❌ Update failed:', updateError.message);
        return;
    }

    if (!updateResult || updateResult.length === 0) {
        console.log('❌ Update returned no data (RLS issue or no rows matched)');
        return;
    }

    console.log('✅ Update successful!');
    console.log('Updated record:', JSON.stringify(updateResult[0], null, 2));

    // 4. Load fresh from database to confirm persistence
    console.log('\n📡 Loading fresh data...');
    const { data: freshData, error: reloadError } = await supabase
        .from('team_members')
        .select('*')
        .eq('userId', member.userId)
        .single();

    if (reloadError) {
        console.log('❌ Reload failed:', reloadError.message);
        return;
    }

    console.log('📋 Fresh data from database:');
    console.log(JSON.stringify(freshData, null, 2));

    // 5. Check if birthDate persisted
    if (freshData.birthDate === testBirthday || freshData.birth_date === testBirthday) {
        console.log('\n✅ SUCCESS: Birthday persisted correctly!');
        console.log(`   birthDate: ${freshData.birthDate}`);
        console.log(`   birth_date: ${freshData.birth_date}`);
    } else {
        console.log('\n❌ FAIL: Birthday did NOT persist!');
        console.log(`   Expected: ${testBirthday}`);
        console.log(`   Got birthDate: ${freshData.birthDate}`);
        console.log(`   Got birth_date: ${freshData.birth_date}`);
    }

    // 6. Now load how AppDataContext does it (join with users)
    console.log('\n📡 Loading via JOIN like AppDataContext...');
    const { data: joinedData, error: joinError } = await supabase
        .from('users')
        .select(`
            *,
            team_members (*)
        `)
        .eq('id', member.userId)
        .single();

    if (joinError) {
        console.log('❌ Join query failed:', joinError.message);
        return;
    }

    console.log('📋 Joined data (users + team_members):');
    console.log(JSON.stringify(joinedData, null, 2));

    const tm = Array.isArray(joinedData.team_members) ? joinedData.team_members[0] : joinedData.team_members;
    console.log('\n📊 Team member portion:');
    console.log(JSON.stringify(tm, null, 2));

    const loadedBirthday = tm?.birthDate || tm?.birth_date;
    console.log(`\n🎂 Final loaded birthday: ${loadedBirthday}`);

    if (loadedBirthday === testBirthday) {
        console.log('✅ COMPLETE SUCCESS: Full flow works!');
    } else {
        console.log('❌ FAIL: Birthday not loading correctly from joined query');
    }
}

testBirthdayFlow();
