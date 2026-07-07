import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cauovzsralvyssdhiasp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wapGXb79YbDBMJoYF1C9-Q_Mvx4Jc-5';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
