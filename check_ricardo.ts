import { supabase } from './src/logic/api/supabase';

async function check() {
  const { data: members, error } = await supabase
    .from('members')
    .select('*, subscriptions(*, plan:plans(*))')
    .ilike('nombre', '%Ricardo%')
    .ilike('apellido', '%Amaya%');

  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(members, null, 2));
}
check();
