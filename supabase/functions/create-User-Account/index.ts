/// <reference lib="deno.window" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json'
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'Method not allowed' 
    }), { 
      status: 405,
      headers: corsHeaders 
    })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )

    // ✅ Vérifier authentification
    const authHeader = req.headers.get('Authorization')?.split(' ')[1]
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized' 
      }), { 
        status: 401,
        headers: corsHeaders 
      })
    }

    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(authHeader)
    if (authError || !adminUser) {
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid token' 
      }), { 
        status: 401,
        headers: corsHeaders 
      })
    }

    // ✅ Vérifier que l'utilisateur est admin
    const { data: adminProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', adminUser.id)
      .maybeSingle()

    if (profileError || !adminProfile || adminProfile.role !== 'admin') {
      console.error('[EDGE] Unauthorized - not admin')
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Only admins can create accounts' 
      }), { 
        status: 403,
        headers: corsHeaders 
      })
    }

    // ✅ Parser request body
    const { email, password, displayName, telephone, role } = await req.json()

    // ✅ VALIDATION DES DONNÉES
    const validationErrors = [];

    // Email
    if (!email || typeof email !== 'string' || email.trim() === '') {
      validationErrors.push('Email manquant');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.push('Format email invalide');
    }

    // Password
    if (!password || typeof password !== 'string' || password.trim() === '') {
      validationErrors.push('Mot de passe manquant');
    } else if (password.length < 6) {
      validationErrors.push('Mot de passe trop court (min 6 caractères)');
    }

    // DisplayName
    if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
      validationErrors.push('Nom/Pseudo manquant');
    } else if (displayName.trim().length < 2) {
      validationErrors.push('Nom/Pseudo trop court (min 2 caractères)');
    }

    // Téléphone
    if (!telephone || typeof telephone !== 'string' || telephone.trim() === '') {
      validationErrors.push('Téléphone manquant');
    } else if (!/^[0-9\s\-\+\(\)]+$/.test(telephone)) {
      validationErrors.push('Format téléphone invalide');
    } else if (telephone.replace(/\D/g, '').length < 9) {
      validationErrors.push('Numéro de téléphone incomplet');
    }

    // Rôle
    if (!role || typeof role !== 'string' || role.trim() === '') {
      validationErrors.push('Rôle manquant');
    } else if (!['organizer', 'public'].includes(role)) {
      validationErrors.push('Rôle invalide (organizer ou public)');
    }

    // ❌ Si erreurs, retourner avec détails
    if (validationErrors.length > 0) {
      console.error('[EDGE] Validation errors:', validationErrors);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Validation échouée',
          details: validationErrors
        }), 
        { status: 400, headers: corsHeaders }
      )
    }

    // ✅ Créer user dans Auth
    const { data: { user }, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role }
    })

    if (signUpError) {
      console.error('[EDGE] Auth error:', signUpError.message)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Erreur création compte: ' + signUpError.message 
      }), { 
        status: 400,
        headers: corsHeaders 
      })
    }

    // ✅ Vérifier que user a un ID
    if (!user || !user.id) {
      console.error('[EDGE] User created but no ID returned')
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Erreur: Compte créé mais pas d\'ID' 
      }), { 
        status: 500,
        headers: corsHeaders 
      })
    }

    // ✅ Créer profil dans profiles
    const { error: insertProfileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: user.id,
        email,
        displayName,
        telephone,
        role,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (insertProfileError) {
      console.error('[EDGE] Profile error:', insertProfileError.message)
      // Essayer de supprimer l'user créé en Auth
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Erreur création profil: ' + insertProfileError.message 
      }), { 
        status: 400,
        headers: corsHeaders 
      })
    }

    console.log('[EDGE] Account created successfully:', user.id)
    return new Response(
      JSON.stringify({
        success: true,
        user_id: user.id,
        email,
        displayName,
        role,
        message: `Compte créé: ${displayName} (${email})`
      }),
      { status: 200, headers: corsHeaders }
    )

  } catch (error) {
    console.error('[EDGE] Unexpected error:', error.message)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Erreur serveur: ' + (error.message || 'Unknown error') 
      }),
      { status: 500, headers: corsHeaders }
    )
  }
})