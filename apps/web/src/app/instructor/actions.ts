'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { courseDetailsSchema, lessonSchema, newCourseSchema } from '@/lib/forms/course';
import { type FormState, invalid, parseForm } from '@/lib/forms/form-state';
import { getSession, hasRole } from '@/server/auth/session';
import * as authoring from '@/server/authoring';

// Server actions are public endpoints: each one checks the session, and the authoring service
// checks that the course belongs to this instructor (or that they are an admin).

async function instructor() {
  const session = await getSession();
  if (!session || !hasRole(session, 'instructor')) throw new Error('Not allowed.');
  return session;
}

const id = z.uuid();
const title = z.string().trim().min(1).max(150);
const direction = z.enum(['up', 'down']);

const editorPath = (courseId: string) => `/instructor/courses/${courseId}`;

function refresh(courseId: string) {
  revalidatePath(editorPath(courseId));
  revalidatePath('/instructor');
}

async function sectionCourseId(sectionId: string) {
  return (await authoring.getSectionCourseId(sectionId)) ?? '';
}

export async function createCourse(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await instructor();
  const { result, values } = parseForm(newCourseSchema, formData);
  if (!result.success) return invalid(result.error, values);
  const course = await authoring.createCourse(session, result.data);
  redirect(editorPath(course.id));
}

export async function updateDetails(
  courseId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await instructor();
  const { result, values } = parseForm(courseDetailsSchema, formData);
  if (!result.success) return invalid(result.error, values);
  try {
    await authoring.updateCourseDetails(session, id.parse(courseId), result.data);
  } catch (error) {
    if (error instanceof authoring.AuthoringError) {
      return { status: 'invalid', message: error.message, values };
    }
    throw error;
  }
  refresh(courseId);
  return { status: 'received', message: 'Saved.', values };
}

export async function addSection(courseId: string, formData: FormData) {
  const session = await instructor();
  await authoring.addSection(session, id.parse(courseId), title.parse(formData.get('title')));
  refresh(courseId);
}

export async function renameSection(sectionId: string, formData: FormData) {
  const session = await instructor();
  const courseId = await sectionCourseId(id.parse(sectionId));
  await authoring.renameSection(session, sectionId, title.parse(formData.get('title')));
  refresh(courseId);
}

export async function deleteSection(sectionId: string) {
  const session = await instructor();
  const courseId = await sectionCourseId(id.parse(sectionId));
  await authoring.deleteSection(session, sectionId);
  refresh(courseId);
}

export async function moveSection(sectionId: string, to: 'up' | 'down') {
  const session = await instructor();
  const courseId = await sectionCourseId(id.parse(sectionId));
  await authoring.moveSection(session, sectionId, direction.parse(to));
  refresh(courseId);
}

export async function addLesson(sectionId: string, formData: FormData) {
  const session = await instructor();
  const courseId = await sectionCourseId(id.parse(sectionId));
  await authoring.addLesson(session, sectionId, {
    title: title.parse(formData.get('title')),
    type: z.enum(['VIDEO', 'PDF', 'TEXT']).parse(formData.get('type')),
  });
  refresh(courseId);
}

export async function updateLesson(lessonId: string, courseId: string, formData: FormData) {
  const session = await instructor();
  const input = lessonSchema.parse(Object.fromEntries(formData));
  await authoring.updateLesson(session, id.parse(lessonId), input);
  refresh(id.parse(courseId));
}

export async function deleteLesson(lessonId: string, courseId: string) {
  const session = await instructor();
  await authoring.deleteLesson(session, id.parse(lessonId));
  refresh(id.parse(courseId));
}

export async function moveLesson(lessonId: string, courseId: string, to: 'up' | 'down') {
  const session = await instructor();
  await authoring.moveLesson(session, id.parse(lessonId), direction.parse(to));
  refresh(id.parse(courseId));
}

export type ReviewState = { error?: string };

export async function submitForReview(courseId: string): Promise<ReviewState> {
  const session = await instructor();
  try {
    await authoring.submitForReview(session, id.parse(courseId));
  } catch (error) {
    if (error instanceof authoring.AuthoringError) return { error: error.message };
    throw error;
  }
  refresh(courseId);
  revalidatePath('/admin', 'layout');
  return {};
}

export async function withdrawSubmission(courseId: string) {
  const session = await instructor();
  await authoring.withdrawSubmission(session, id.parse(courseId));
  refresh(courseId);
  revalidatePath('/admin', 'layout');
}
