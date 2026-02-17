import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../styles/ProfilePage.css';
import { useUser } from '../hooks/useUser'; // your auth/user context
import { supabase } from '../lib/supabase'; // Assuming supabase is used for auth
import { GoalTree } from '../models/GoalTree';
import { GoalNode } from '../models/GoalNode';

const ProfilePage: React.FC = () => {
    const { user, loading: userLoading } = useUser(); // Replace with your real hook
    const navigate = useNavigate();
    const { id: profileUserIdParam } = useParams<{ id: string }>(); // Get user ID from URL params

    const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);
    const [profileGoalTree, setProfileGoalTree] = useState<GoalTree | null>(null);
    const [goalTreeLoading, setGoalTreeLoading] = useState(true);
    const [goalTreeError, setGoalTreeError] = useState<string | null>(null);

    // Mock/fallback data for other profile details — replace with real fetch/context
    const profile = user || {
        name: 'Alfonso',
        username: '@alfonso_milano',
        avatarUrl: 'https://example.com/avatar.jpg', // placeholder
        bio: 'Building better habits in Milan. Fitness & investing enthusiast. Open to meaningful connections.',
        ageRange: '25-34',
        verified: true,
        domains: ['Fitness', 'Investing', 'Career', 'Relationships'],
        overallGrade: 'Consistent Achiever',
        totalGoals: 17,
        completionRate: 68,
    };

    useEffect(() => {
        const fetchUserId = async () => {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const idToFetch = profileUserIdParam || authUser?.id || '1'; // Prioritize URL param, then auth user, then hardcoded
            setCurrentUserId(idToFetch);
        };
        fetchUserId();
    }, [profileUserIdParam]);

    useEffect(() => {
        const fetchProfileGoalTree = async () => {
            if (!currentUserId) return;

            try {
                const response = await axios.get(`http://localhost:3001/goals/${currentUserId}`);
                setProfileGoalTree(response.data);
            } catch (err) {
                console.error('Failed to fetch profile goal tree:', err);
                setGoalTreeError('Failed to load goal tree.');
            } finally {
                setGoalTreeLoading(false);
            }
        };

        if (currentUserId) {
            fetchProfileGoalTree();
        }
    }, [currentUserId]);

    const renderGoalNode = (node: GoalNode, level = 0) => {
        const children = profileGoalTree?.nodes.filter(n => n.parentId === node.id) || [];
        const hasChildren = children.length > 0;
        // No explicit expandedNodes state for now, just render children
        return (
            <div key={node.id} className={`goal-item level-${level}`}>
                <div className={`goal-header ${hasChildren ? 'has-children' : ''}`}>
                    <div className="goal-title">
                        {node.name} ({node.domain})
                    </div>
                    <div className="goal-meta">
                        {/* Progress bar and text for GoalNode */}
                        <span className="progress-bar-small" style={{ width: `${node.progress * 100}%` }} />
                        <span className="progress-text">{Math.round(node.progress * 100)}%</span>
                        {/* No grade in GoalNode model, but could be added later */}
                    </div>
                </div>

                {hasChildren && (
                    <div className="goal-children">
                        {children.map((child: GoalNode) => renderGoalNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    if (userLoading || goalTreeLoading) return <div className="loading">Loading profile...</div>;

    return (
        <div className="profile-page">
            <div className="profile-header">
                {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Profile" className="avatar-large" />
                ) : (
                    <div className="avatar-placeholder">{profile.name.charAt(0)}</div>
                )}
                <div className="profile-info">
                    <h1>{profile.name}</h1>
                    <p className="username">{profile.username}</p>
                    {profile.verified && (
                        <div className="verified-badge">
                            Verified <span>✓</span>
                        </div>
                    )}
                    <p className="bio">{profile.bio}</p>
                    <div className="quick-stats">
                        <span>{profile.ageRange}</span>
                        <span>•</span>
                        <span>{profile.overallGrade}</span>
                    </div>
                </div>

                <button className="edit-btn" onClick={() => navigate('/profile/edit')}>
                    Edit Profile
                </button>
            </div>

            <div className="profile-stats-card">
                <div className="stat-item">
                    <div className="stat-value">{profileGoalTree?.nodes.length || 0}</div>
                    <div className="stat-label">Goals</div>
                </div>
                {/*
                <div className="stat-item">
                    <div className="stat-value">{profile.completionRate}%</div>
                    <div className="stat-label">Overall Progress</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{profile.domains.length}</div>
                    <div className="stat-label">Focus Areas</div>
                </div>
                */}
            </div>

            <div className="goal-tree-section">
                <h2>Your Goal Tree</h2>
                {goalTreeError ? (
                    <p className="error-state">{goalTreeError}</p>
                ) : !profileGoalTree || profileGoalTree.rootNodes.length === 0 ? (
                    <p className="empty-state">No goals yet. Start building!</p>
                ) : (
                    <div className="goal-tree">
                        {profileGoalTree.rootNodes.map(node => renderGoalNode(node))}
                    </div>
                )}
            </div>

            {/* Future: add sections for recent feedback, matches compatibility preview, etc. */}
        </div>
    );
};

export default ProfilePage;