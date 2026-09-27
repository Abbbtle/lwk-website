import { startSignIn } from '@/server/auth/sign-in';

export async function GET(request: Request) {
  return startSignIn(request, 'signup');
}
