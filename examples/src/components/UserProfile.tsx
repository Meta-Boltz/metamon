// React UserProfile Component for MTM Integration
import React, { useState, useEffect } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
}

interface UserProfileProps {
  userId?: number;
  onUserUpdate?: (user: User) => void;
  className?: string;
}

const UserProfile: React.FC<UserProfileProps> = ({ 
  userId = 1, 
  onUserUpdate,
  className = ''
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<User>>({});

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      const mockUser: User = {
        id: userId,
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: '👤',
        bio: 'Full-stack developer passionate about modern web technologies.'
      };
      setUser(mockUser);
      setEditForm(mockUser);
      setLoading(false);
    }, 500);
  }, [userId]);

  const handleEdit = () => {
    setEditing(true);
  };

  const handleSave = () => {
    if (user && editForm.name && editForm.email) {
      const updatedUser = { ...user, ...editForm };
      setUser(updatedUser);
      setEditing(false);
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
    }
  };

  const handleCancel = () => {
    setEditForm(user || {});
    setEditing(false);
  };

  if (loading) {
    return (
      <div className={`user-profile loading ${className}`}>
        <div className="loading-spinner">Loading user profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`user-profile error ${className}`}>
        <p>User not found</p>
      </div>
    );
  }

  return (
    <div className={`user-profile ${className}`}>
      <div className="profile-header">
        <div className="avatar">{user.avatar}</div>
        <div className="user-info">
          {editing ? (
            <div className="edit-form">
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Name"
                className="form-input"
              />
              <input
                type="email"
                value={editForm.email || ''}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="Email"
                className="form-input"
              />
              <textarea
                value={editForm.bio || ''}
                onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                placeholder="Bio"
                className="form-textarea"
                rows={3}
              />
              <div className="form-actions">
                <button onClick={handleSave} className="btn btn-primary">
                  Save
                </button>
                <button onClick={handleCancel} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="user-details">
              <h3 className="user-name">{user.name}</h3>
              <p className="user-email">{user.email}</p>
              {user.bio && <p className="user-bio">{user.bio}</p>}
              <button onClick={handleEdit} className="btn btn-outline">
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;