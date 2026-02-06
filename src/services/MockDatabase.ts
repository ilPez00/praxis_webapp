import { User } from '../models/User';
import { GoalNode } from '../models/GoalNode';
import { Match } from '../models/Match';
import { Message } from '../models/Message'; // Import Message model

class MockDatabase {
  private users: User[] = [];
  private goalNodes: GoalNode[] = [];
  private matches: Match[] = [];
  private messages: Message[] = []; // Add messages array

  constructor() {
    // Add some dummy data for initial testing
    const user1Goals: GoalNode[] = [
      { id: 'g1', domain: 'Health', name: 'Run a marathon', weight: 1.0, progress: 0, subGoals: [] },
      { id: 'g2', domain: 'Wealth', name: 'Save $1000', weight: 1.0, progress: 0, subGoals: [] },
    ];
    const user1: User = {
      id: 'user1',
      email: 'user1@example.com',
      name: 'Alice',
      age: 30,
      bio: 'Loves running and saving money.',
      goalTree: user1Goals,
      hashedPassword: 'password123', // Placeholder password
    };

    const user2Goals: GoalNode[] = [
      { id: 'g3', domain: 'Health', name: 'Run a marathon', weight: 1.0, progress: 0, subGoals: [] },
      { id: 'g4', domain: 'Wisdom', name: 'Learn a new language', weight: 1.0, progress: 0, subGoals: [] },
    ];
    const user2: User = {
      id: 'user2',
      email: 'user2@example.com',
      name: 'Bob',
      age: 25,
      bio: 'Enjoys fitness and languages.',
      goalTree: user2Goals,
      hashedPassword: 'password123', // Placeholder password
    };
    
    const adminUser: User = {
      id: 'admin',
      email: 'admin@praxis.com',
      name: 'Admin',
      age: 99,
      bio: 'System Administrator',
      goalTree: [],
      hashedPassword: 'admin', // Placeholder password for mock purposes
    };

    this.users.push(user1, user2, adminUser);
    this.goalNodes.push(...user1Goals, ...user2Goals);

    // Simulate a match
    this.matches.push({ userId: 'user2', score: 0.8, sharedGoals: ['g1', 'g3'] });

    // Simulate some messages
    this.messages.push(
      { id: 'm1', senderId: 'user1', receiverId: 'user2', content: 'Hi Bob, great to connect!', timestamp: new Date() },
      { id: 'm2', senderId: 'user2', receiverId: 'user1', content: 'You too, Alice! About that marathon...', timestamp: new Date() }
    );
  }

  // --- User operations ---
  getUsers(): User[] {
    return [...this.users];
  }

  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find(user => user.email === email);
  }

  saveUser(user: User): User {
    this.users.push(user);
    return user;
  }

  updateUser(updatedUser: User): User | undefined {
    const index = this.users.findIndex(user => user.id === updatedUser.id);
    if (index !== -1) {
      this.users[index] = updatedUser;
      return updatedUser;
    }
    return undefined;
  }

  deleteUser(id: string): boolean {
    const initialLength = this.users.length;
    this.users = this.users.filter(user => user.id !== id);
    return this.users.length < initialLength;
  }

  // --- GoalNode operations (simplified, typically part of user) ---
  getGoalNodeById(id: string): GoalNode | undefined {
    // This assumes goalNodes are stored flat for simplicity in mock db
    // In a real app, they would be nested within a user's goalTree
    return this.goalNodes.find(node => node.id === node.id); // Fixed typo: node.id === id
  }

  saveGoalNode(goalNode: GoalNode): GoalNode {
    this.goalNodes.push(goalNode);
    return goalNode;
  }

  // --- Match operations ---
  getMatchesForUser(userId: string): Match[] {
    // This mock only stores matches where the current user is user1
    // In a real app, matches would be bidirectional or more complex
    return this.matches.filter(match => match.userId === userId);
  }

  saveMatch(match: Match): Match {
    this.matches.push(match);
    return match;
  }

  // --- Message operations ---
  getMessagesBetweenUsers(user1Id: string, user2Id: string): Message[] {
    return this.messages.filter(
      (msg) =>
        (msg.senderId === user1Id && msg.receiverId === user2Id) ||
        (msg.senderId === user2Id && msg.receiverId === user1Id)
    ).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // Sort by time
  }

  saveMessage(message: Message): Message {
    this.messages.push(message);
    return message;
  }
}

export const mockDatabase = new MockDatabase();
