// supabase/functions/delete-user-account/index.ts
/// <reference lib="deno.window" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  console.log('[DELETE] 🚀 Request received:', req.method);
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[DELETE] ✅ OPTIONS preflight');
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  if (req.method !== 'POST') {
    console.log('[DELETE] ❌ Invalid method:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: corsHeaders 
    })
  }

  try {
    console.log('[DELETE] 🔑 Creating admin client...');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // Vérifier que l'appelant est admin
    console.log('[DELETE] 🔐 Checking authorization header...');
    const authHeader = req.headers.get('Authorization')?.split(' ')[1]
    if (!authHeader) {
      console.log('[DELETE] ❌ No auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401,
        headers: corsHeaders 
      })
    }

    console.log('[DELETE] 👤 Getting admin user...');
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(authHeader)
    if (authError || !adminUser) {
      console.log('[DELETE] ❌ Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401,
        headers: corsHeaders 
      })
    }

    console.log('[DELETE] 👑 Admin user ID:', adminUser.id);

    // Vérifier que l'appelant est admin
    console.log('[DELETE] 📋 Checking admin profile...');
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .single()

    if (adminProfileError) {
      console.log('[DELETE] ❌ Admin profile error:', adminProfileError);
      return new Response(JSON.stringify({ error: 'Admin profile not found' }), { 
        status: 401,
        headers: corsHeaders 
      })
    }

    console.log('[DELETE] 👑 Admin role:', adminProfile?.role);

    if (adminProfile?.role !== 'admin') {
      console.log('[DELETE] ❌ User is not admin');
      return new Response(JSON.stringify({ error: 'Only admins can delete accounts' }), { 
        status: 403,
        headers: corsHeaders 
      })
    }

    // Récupérer l'ID utilisateur à supprimer
    console.log('[DELETE] Parsing request body...');
const body = await req.json()
console.log('[DELETE] Body received:', body);

const { userId, deletion_admin_reason, deletion_approved_at } = body

if (!userId) {
  console.log('[DELETE] Missing userId');
  return new Response(JSON.stringify({ error: 'Missing userId' }), { 
    status: 400,
    headers: corsHeaders 
  })
}

console.log('[DELETE] Target user ID:', userId);
console.log('[DELETE] Deletion admin reason:', deletion_admin_reason);
console.log('[DELETE] Deletion approved at:', deletion_approved_at);

    // Empêcher admin de se supprimer lui-même
    if (userId === adminUser.id) {
      console.log('[DELETE] ❌ Cannot delete own account');
      return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { 
        status: 400,
        headers: corsHeaders 
      })
    }

    // Vérifier que l'utilisateur à supprimer n'est pas admin
    console.log('[DELETE] 📋 Fetching target profile...');
    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', userId)
      .single()

    if (targetProfileError) {
      console.log('[DELETE] ❌ Target profile error:', targetProfileError);
      return new Response(JSON.stringify({ error: 'Target profile not found' }), { 
        status: 400,
        headers: corsHeaders 
      })
    }

    console.log('[DELETE] 📧 Target email:', targetProfile?.email);

    if (targetProfile?.role === 'admin') {
      console.log('[DELETE] ❌ Cannot delete admin accounts');
      return new Response(JSON.stringify({ error: 'Cannot delete admin accounts' }), { 
        status: 400,
        headers: corsHeaders 
      })
    }

    // ✅ SOFT DELETE: Marquer comme inactif au lieu de supprimer
    console.log('[DELETE] Marking user as inactive...');
const { error: updateError } = await supabaseAdmin
  .from('profiles')
  .update({ 
    is_active: false,
    deletion_approved_at: deletion_approved_at || new Date().toISOString(),
    deletion_admin_reason: deletion_admin_reason || null,
    updated_at: new Date().toISOString()
  })
  .eq('id', userId)

if (updateError) {
  console.log('[DELETE] Update error:', updateError.message);
  return new Response(JSON.stringify({ error: updateError.message }), { 
    status: 400,
    headers: corsHeaders 
  })
}

    console.log('[DELETE] ✅ User marked as inactive');

    // ✅ Supprimer de auth.users (maintenant sans contrainte FK)
    console.log('[DELETE] 🔑 Deleting from auth.users...');
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (authDeleteError) {
      console.log('[DELETE] ⚠️ Auth delete warning (non-blocking):', authDeleteError.message);
      // On continue quand même - le profil est marqué inactif
    } else {
      console.log('[DELETE] ✅ Auth user deleted');
    }

    console.log('[DELETE] ✅ Account deleted successfully:', targetProfile?.email);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Account ${targetProfile?.email} deleted successfully (soft delete)`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.log('[DELETE] 🔥 Catch error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: corsHeaders }
    )
  }
})