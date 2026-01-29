'use client';

import { createClient } from '../../supabase/client';

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  full_name: string | null;
  cover_image: string | null;
  cover_image_position: { x: number; y: number };
  profile_picture: string | null;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.error('Error fetching user profile:', error);
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    full_name: data.full_name,
    cover_image: data.cover_image,
    cover_image_position: data.cover_image_position || { x: 0, y: 0 },
    profile_picture: data.profile_picture,
  };
}

export async function uploadProfileImage(
  userId: string,
  file: File,
  type: 'cover' | 'profile'
): Promise<string | null> {
  const supabase = createClient();
  
  // Create unique filename in dashboard-images folder
  const fileExt = file.name.split('.').pop();
  const fileName = `dashboard-images/${userId}-${type}-${Date.now()}.${fileExt}`;
  
  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('canvas-uploads')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Error uploading image:', error);
    return null;
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('canvas-uploads')
    .getPublicUrl(fileName);

  return publicUrl;
}

export async function updateUserCoverImage(
  userId: string,
  imageUrl: string
): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ cover_image: imageUrl })
    .eq('id', userId);

  if (error) {
    console.error('Error updating cover image:', error);
    return false;
  }

  return true;
}

export async function updateUserCoverImagePosition(
  userId: string,
  position: { x: number; y: number }
): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ cover_image_position: position })
    .eq('id', userId);

  if (error) {
    console.error('Error updating cover image position:', error);
    return false;
  }

  return true;
}

export async function updateUserProfilePicture(
  userId: string,
  imageUrl: string
): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ profile_picture: imageUrl })
    .eq('id', userId);

  if (error) {
    console.error('Error updating profile picture:', error);
    return false;
  }

  return true;
}

export async function removeUserCoverImage(userId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ cover_image: null, cover_image_position: { x: 0, y: 0 } })
    .eq('id', userId);

  if (error) {
    console.error('Error removing cover image:', error);
    return false;
  }

  return true;
}

export async function removeUserProfilePicture(userId: string): Promise<boolean> {
  const supabase = createClient();
  
  const { error } = await supabase
    .from('users')
    .update({ profile_picture: null })
    .eq('id', userId);

  if (error) {
    console.error('Error removing profile picture:', error);
    return false;
  }

  return true;
}
