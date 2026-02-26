import { Domain } from './Domain';

export interface Achievement {
  id: string;
  userId: string;
  userName: string; // Denormalized for easier display
  userAvatarUrl?: string; // Denormalized for easier display
  goalNodeId: string;
  title: string;
  description?: string;
  domain: Domain;
  createdAt: Date;
  totalUpvotes: number;
  totalDownvotes: number;
  video_url?: string; // Optional video confirmation URL
}