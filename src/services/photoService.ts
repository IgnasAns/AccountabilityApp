import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { decode } from 'base64-arraybuffer';

// Request camera permissions
export async function requestCameraPermissions(): Promise<boolean> {
    if (Platform.OS === 'web') return true;

    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    return cameraStatus === 'granted' && mediaStatus === 'granted';
}

// Pick image from camera
export async function takePhoto(): Promise<string | null> {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
        throw new Error('Camera permission is required to take photos');
    }

    const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
        return null;
    }

    return result.assets[0].uri;
}

// Pick image from library
export async function pickImage(): Promise<string | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Media library permission is required');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) {
        return null;
    }

    return result.assets[0].uri;
}

// Compress image before upload
async function compressImage(uri: string): Promise<{ uri: string; base64: string }> {
    const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }], // Max width 1200px
        {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
        }
    );

    return {
        uri: manipulated.uri,
        base64: manipulated.base64 || '',
    };
}

// Upload image to Supabase Storage
export async function uploadProofPhoto(
    imageUri: string,
    groupId: string
): Promise<string> {
    try {
        // Compress the image
        const { base64 } = await compressImage(imageUri);

        if (!base64) {
            throw new Error('Failed to process image');
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Not authenticated');
        }

        // Generate unique filename
        const timestamp = Date.now();
        const filename = `${user.id}/${groupId}_${timestamp}.jpg`;

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
            .from('proof-photos')
            .upload(filename, decode(base64), {
                contentType: 'image/jpeg',
                upsert: false,
            });

        if (error) {
            console.error('Upload error:', error);
            throw new Error('Failed to upload photo: ' + error.message);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('proof-photos')
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Photo upload failed:', error);
        throw error;
    }
}

// Upload group cover image to Supabase Storage
export async function uploadGroupCover(
    imageUri: string,
    groupId: string
): Promise<string> {
    try {
        const { base64 } = await compressImage(imageUri);
        if (!base64) throw new Error('Failed to process image');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const filename = `groups/${groupId}_cover_${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
            .from('proof-photos') // Reusing the same bucket for simplicity
            .upload(filename, decode(base64), {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('proof-photos')
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Group cover upload failed:', error);
        throw error;
    }
}

// Upload user avatar to Supabase Storage
export async function uploadAvatar(
    imageUri: string
): Promise<string> {
    try {
        const { base64 } = await compressImage(imageUri);
        if (!base64) throw new Error('Failed to process image');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const filename = `avatars/${user.id}_${Date.now()}.jpg`;

        const { data, error } = await supabase.storage
            .from('proof-photos') // Reusing the same bucket
            .upload(filename, decode(base64), {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) throw error;

        const { data: urlData } = supabase.storage
            .from('proof-photos')
            .getPublicUrl(data.path);

        return urlData.publicUrl;
    } catch (error) {
        console.error('Avatar upload failed:', error);
        throw error;
    }
}
