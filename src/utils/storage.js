import { supabase } from '../supabase'

export async function uploadRecipeAttachment(file) {
  const { data: { user } } = await supabase.auth.getUser()
  const ext = file.name.split('.').pop().toLowerCase() || 'jpg'
  const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '-').toLowerCase()
  const path = `${user.id}/${Date.now()}-${safeName}`

  const { data, error } = await supabase.storage
    .from('recipe-photos')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('recipe-photos')
    .getPublicUrl(data.path)

  return publicUrl
}

export function isImageUrl(url) {
  return /\.(jpe?g|png|gif|webp|heic|bmp)(\?|$)/i.test(url)
}
