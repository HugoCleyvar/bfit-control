import { supabase } from './src/logic/api/supabase';

async function list() {
  const { data, error } = await supabase
    .from('members')
    .select('nombre, apellido, visitas_disponibles, estatus')
    .order('fecha_registro', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}
list();
