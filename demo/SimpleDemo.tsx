import React, { useState } from 'react';

// Simple demo component to test the basic structure without Supabase dependencies
export const SimpleDemo: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'browse' | 'create'>('browse');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              CLAUDE.md Hub (Demo)
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('browse')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'browse'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Browse
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {activeTab === 'browse' ? (
          <BrowseView />
        ) : (
          <CreateView />
        )}
      </div>
    </div>
  );
};

const BrowseView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const mockDocs = [
    {
      id: '1',
      title: 'React TypeScript Setup',
      description: 'Complete guide for setting up React with TypeScript',
      author: 'john_doe',
      tags: ['react', 'typescript', 'setup'],
      stars: 42,
      views: 150,
      downloads: 25
    },
    {
      id: '2',
      title: 'Supabase Authentication',
      description: 'How to implement GitHub OAuth with Supabase',
      author: 'jane_smith',
      tags: ['supabase', 'auth', 'github'],
      stars: 38,
      views: 120,
      downloads: 18
    },
    {
      id: '3',
      title: 'API Documentation Template',
      description: 'Standard template for API documentation',
      author: 'api_master',
      tags: ['api', 'documentation', 'template'],
      stars: 67,
      views: 200,
      downloads: 45
    }
  ];

  const filteredDocs = mockDocs.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div>
      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search CLAUDE.md documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Documents Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocs.map(doc => (
          <div key={doc.id} className="bg-white rounded-lg shadow-sm border p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {doc.title}
              </h3>
              <div className="flex items-center gap-1 ml-2">
                <button className="p-1.5 text-gray-400 hover:text-yellow-500 rounded transition-colors">
                  <span className="text-sm">★</span>
                </button>
                <button className="p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors">
                  <span className="text-sm">⬇</span>
                </button>
              </div>
            </div>

            <p className="text-gray-600 text-sm mb-3 line-clamp-2">
              {doc.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mb-3">
              {doc.tags.map(tag => (
                <span 
                  key={tag}
                  className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Author and Stats */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>by @{doc.author}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span>★</span> {doc.stars}
                </span>
                <span className="flex items-center gap-1">
                  <span>👁</span> {doc.views}
                </span>
                <span className="flex items-center gap-1">
                  <span>⬇</span> {doc.downloads}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDocs.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No documents found
          </h3>
          <p className="text-gray-600">
            Try adjusting your search or create the first document!
          </p>
        </div>
      )}
    </div>
  );
};

const CreateView: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Document created!\nTitle: ${title}\nDescription: ${description}\nTags: ${tags}`);
    
    // Reset form
    setTitle('');
    setDescription('');
    setContent('');
    setTags('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Create CLAUDE.md Document
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
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
              required
            />
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
            />
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. react, typescript, api"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Content */}
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
              Content (Markdown) *
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
              rows={15}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
              required
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SimpleDemo;