import React, { useState, useEffect } from 'react';
import { ClaudeDocService, TagService } from '../services';
import { useAuth } from '../auth';
import type { ClaudeDocResponse, CreateClaudeDocRequest, UpdateClaudeDocRequest } from '../types/database';

interface ClaudeDocEditorProps {
  docId?: string; // If provided, edit mode; otherwise, create mode
  onSave?: (doc: ClaudeDocResponse) => void;
  onCancel?: () => void;
}

export const ClaudeDocEditor: React.FC<ClaudeDocEditorProps> = ({
  docId,
  onSave,
  onCancel
}) => {
  const { user } = useAuth();
  const docService = new ClaudeDocService();
  const tagService = new TagService();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);

  // Tag suggestions
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Load document for editing
  useEffect(() => {
    if (docId && user) {
      loadDocument();
    }
  }, [docId, user]);

  // Load tag suggestions when tag input changes
  useEffect(() => {
    if (tagInput.length >= 2) {
      loadTagSuggestions();
    } else {
      setTagSuggestions([]);
      setShowTagSuggestions(false);
    }
  }, [tagInput]);

  const loadDocument = async () => {
    if (!docId || !user) return;

    setLoading(true);
    try {
      const doc = await docService.getDocument(docId, user.id, false); // Don't increment view
      
      if (!doc) {
        setError('Document not found or access denied');
        return;
      }

      setTitle(doc.title);
      setDescription(doc.description || '');
      setContent(doc.content);
      setSelectedTags(doc.tag_names);
      setIsPublic(doc.is_public);
    } catch (error) {
      console.error('Failed to load document:', error);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const loadTagSuggestions = async () => {
    try {
      const suggestions = await tagService.getTagSuggestions(tagInput);
      setTagSuggestions(suggestions);
      setShowTagSuggestions(true);
    } catch (error) {
      console.error('Failed to load tag suggestions:', error);
    }
  };

  const handleAddTag = (tagName: string) => {
    const normalizedTag = tagName.trim().toLowerCase();
    
    if (normalizedTag && !selectedTags.includes(normalizedTag) && selectedTags.length < 10) {
      setSelectedTags(prev => [...prev, normalizedTag]);
    }
    
    setTagInput('');
    setShowTagSuggestions(false);
  };

  const handleRemoveTag = (tagName: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagName));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === 'Escape') {
      setShowTagSuggestions(false);
    }
  };

  const validateForm = (): string | null => {
    if (!title.trim()) {
      return 'Title is required';
    }
    
    if (title.length > 200) {
      return 'Title must be 200 characters or less';
    }
    
    if (!content.trim()) {
      return 'Content is required';
    }
    
    if (content.length > 1000000) {
      return 'Content is too large (max 1MB)';
    }
    
    if (description.length > 500) {
      return 'Description must be 500 characters or less';
    }
    
    return null;
  };

  const handleSave = async () => {
    if (!user) {
      setError('You must be logged in to save documents');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const docData = {
        title: title.trim(),
        description: description.trim(),
        content: content.trim(),
        tag_names: selectedTags,
        is_public: isPublic
      };

      let savedDoc: ClaudeDocResponse;

      if (docId) {
        // Update existing document
        savedDoc = await docService.updateDocument(docId, docData as UpdateClaudeDocRequest, user.id);
      } else {
        // Create new document
        savedDoc = await docService.createDocument(docData as CreateClaudeDocRequest, user.id);
      }

      onSave?.(savedDoc);
    } catch (error) {
      console.error('Failed to save document:', error);
      setError(error instanceof Error ? error.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  // Generate recommended tags based on content
  const getRecommendedTags = () => {
    return tagService.getRecommendedTags(title, description, content)
      .filter(tag => !selectedTags.includes(tag))
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
              {docId ? 'Edit Document' : 'Create CLAUDE.md'}
            </h1>
            <button
              onClick={onCancel}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              ✕
            </button>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">{title.length}/200 characters</p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the document..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{description.length}/500 characters</p>
            </div>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              
              {/* Selected Tags */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedTags.map(tag => (
                    <span
                      key={tag}
                      className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Tag Input */}
              <div className="relative">
                <input
                  id="tags"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder="Type to add tags..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                
                {/* Tag Suggestions */}
                {showTagSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                    {tagSuggestions.map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Recommended Tags */}
              {(title || description || content) && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">Recommended:</p>
                  <div className="flex flex-wrap gap-1">
                    {getRecommendedTags().map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleAddTag(tag)}
                        className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs hover:bg-gray-200 transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-gray-500 mt-1">
                {selectedTags.length}/10 tags • Press Enter to add
              </p>
            </div>

            {/* Content */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
                Content * (Markdown)
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# CLAUDE.md

This file provides guidance to Claude Code when working with your project.

## Setup

Describe how to set up and use your project...

## Examples

Provide examples and usage instructions..."
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {(content.length / 1000).toFixed(1)}KB / 1000KB
              </p>
            </div>

            {/* Visibility */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Visibility
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="visibility"
                    checked={isPublic}
                    onChange={() => setIsPublic(true)}
                    className="mr-2"
                  />
                  <span className="text-sm">Public - Anyone can view and download</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="visibility"
                    checked={!isPublic}
                    onChange={() => setIsPublic(false)}
                    className="mr-2"
                  />
                  <span className="text-sm">Private - Only you can view</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="border-t bg-gray-50 px-6 py-4 rounded-b-lg">
            <div className="flex items-center justify-between">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              <button
                onClick={handleSave}
                disabled={saving || !title.trim() || !content.trim()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {saving ? 'Saving...' : (docId ? 'Update' : 'Create')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};