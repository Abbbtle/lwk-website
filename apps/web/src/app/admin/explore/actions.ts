'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { newResourceSchema, resourceDetailsSchema } from '@/lib/forms/resource';
import { getSession, hasRole } from '@/server/auth/session';
import { MediaError } from '@/server/media';
import * as resources from '@/server/resources';
import { loadSampleContent, removeSampleContent } from '@/server/sample-content';

// Server actions are public endpoints: each one checks the admin role, and the resources
// service checks it again.

async function admin() {
  const session = await getSession();
  if (!session || !hasRole(session, 'admin')) throw new Error('Not allowed.');
  return session;
}

const id = z.uuid();

function refresh(resourceId?: string) {
  revalidatePath('/admin/explore');
  if (resourceId) revalidatePath(`/admin/explore/${resourceId}`);
  revalidatePath('/explore');
}

export async function createResource(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await admin();
  const { result, values } = parseForm(newResourceSchema, formData);
  if (!result.success) return invalid(result.error, values);
  const resource = await resources.createResource(session, result.data);
  redirect(`/admin/explore/${resource.id}`);
}

export async function updateResource(
  resourceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await admin();
  const { result, values } = parseForm(resourceDetailsSchema, formData);
  if (!result.success) return invalid(result.error, values);
  try {
    await resources.updateResource(session, id.parse(resourceId), result.data);
  } catch (error) {
    if (error instanceof resources.ResourceError) {
      return { status: 'invalid', message: error.message, values };
    }
    throw error;
  }
  refresh(resourceId);
  return { status: 'received', message: 'Saved.', values };
}

export type PublishState = { error?: string; done?: string };

export async function setPublished(resourceId: string, published: boolean): Promise<PublishState> {
  const session = await admin();
  try {
    await resources.setResourcePublished(session, id.parse(resourceId), published);
  } catch (error) {
    if (error instanceof resources.ResourceError) return { error: error.message };
    throw error;
  }
  refresh(resourceId);
  return { done: published ? 'Published: it is now in Explore.' : 'Unpublished.' };
}

export async function deleteResource(resourceId: string): Promise<PublishState> {
  const session = await admin();
  await resources.deleteResource(session, id.parse(resourceId));
  refresh();
  redirect('/admin/explore');
}

const fileInfo = z.object({ contentType: z.string().max(100), size: z.number().int().positive() });
const fileKind = z.enum(['media', 'cover']);

async function uploadErrors<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof MediaError || error instanceof resources.ResourceError) {
      return { error: error.message };
    }
    console.error('Resource upload failed', error);
    return { error: 'The upload could not be prepared. Please try again.' };
  }
}

export async function requestResourceUpload(
  resourceId: string,
  file: 'media' | 'cover',
  info: { contentType: string; size: number },
) {
  const session = await admin();
  return uploadErrors(() =>
    resources.startResourceUpload(
      session,
      id.parse(resourceId),
      fileKind.parse(file),
      fileInfo.parse(info),
    ),
  );
}

export async function confirmResourceUpload(
  resourceId: string,
  file: 'media' | 'cover',
  key: string,
  durationSeconds?: number,
) {
  const session = await admin();
  const result = await uploadErrors(async () => {
    const seconds =
      durationSeconds === undefined
        ? undefined
        : z
            .number()
            .min(0)
            .max(24 * 3600)
            .parse(durationSeconds);
    await resources.attachResourceFile(
      session,
      id.parse(resourceId),
      fileKind.parse(file),
      z.string().max(300).parse(key),
      seconds,
    );
    return {};
  });
  refresh(resourceId);
  return result;
}

export async function loadSamples(): Promise<PublishState> {
  const session = await admin();
  try {
    await loadSampleContent(session);
  } catch (error) {
    console.error('Loading sample content failed', error);
    return { error: 'Sample content could not be loaded.' };
  }
  revalidatePath('/', 'layout');
  return { done: 'Sample courses and articles are live, each marked "Sample".' };
}

export async function removeSamples(): Promise<PublishState> {
  const session = await admin();
  try {
    const removed = await removeSampleContent(session);
    revalidatePath('/', 'layout');
    return {
      done: `Removed ${removed.courses} sample courses and ${removed.resources} sample resources.`,
    };
  } catch (error) {
    console.error('Removing sample content failed', error);
    return { error: 'Sample content could not be removed.' };
  }
}
