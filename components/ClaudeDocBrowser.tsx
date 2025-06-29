import React, { useState, useEffect, useCallback } from 'react';
import { ClaudeDocService, TagService, SearchService } from '../services';
import { useAuth } from '../auth';
import type { 
  ClaudeDocResponse, 
  Tag, 
  SearchParams 
} from '../types/database';
import { UserProfile } from './UserProfile';

// Predefined developer tags
const PREDEFINED_TAGS = [
  // Languages
  'typescript', 'javascript', 'python', 'golang', 'rust', 'java', 'csharp', 'ruby', 'php',
  // Frameworks
  'react', 'vue', 'angular', 'nextjs', 'svelte', 'express', 'fastapi', 'django', 'rails', 'laravel',
  // Infrastructure
  'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ansible',
  // Databases
  'postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch',
  // Tools
  'git', 'vscode', 'intellij', 'postman', 'figma', 'slack',
  // APIs
  'rest', 'graphql', 'websocket', 'grpc', 'oauth', 'jwt',
  // Platforms
  'web', 'mobile', 'desktop', 'cli', 'api', 'microservices'
];

interface ClaudeDocBrowserProps {
  onCreateNew?: () => void;
  onEdit?: (docId: string) => void;
}

export const ClaudeDocBrowser: React.FC<ClaudeDocBrowserProps> = ({
  onCreateNew,
  onEdit
}) => {
  // Services
  const docService = new ClaudeDocService();
  const tagService = new TagService();
  const searchService = new SearchService();

  // Auth state
  const { user, signInWithGithub } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  // State management
  const [docs, setDocs] = useState<ClaudeDocResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Array<Tag & { doc_count: number }>>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'created_at' | 'stars' | 'views' | 'downloads'>('created_at');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedDoc, setSelectedDoc] = useState<ClaudeDocResponse | null>(null);
  
  // Mobile UI state
  const [showTagsPanel, setShowTagsPanel] = useState(false);
  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [starringDocId, setStarringDocId] = useState<string | null>(null);

  // Load documents
  const loadDocs = useCallback(async (resetPage = false) => {
    setLoading(true);
    try {
      const params: SearchParams = {
        query: searchQuery,
        tags: selectedTags,
        page: resetPage ? 1 : currentPage,
        per_page: 20,
        sort_by: sortBy
      };

      const response = await docService.getPublicDocs(params);
      
      setDocs(response.docs);
      setTotal(response.total);
      setTotalPages(response.total_pages);
      
      if (resetPage) {
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTags, currentPage, sortBy]);

  // Load tags
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.getPopularTags(50);
      setAvailableTags(tags);
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  }, []);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadDocs(true);
  }, [searchQuery, selectedTags, sortBy]);

  useEffect(() => {
    loadTags();
  }, []);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  // Handle tag selection
  const toggleTag = (tagName: string) => {
    setSelectedTags(prev => {
      const isSelected = prev.includes(tagName);
      if (isSelected) {
        return prev.filter(t => t !== tagName);
      } else {
        return [...prev, tagName];
      }
    });
    setCurrentPage(1);
  };

  // Handle starring
  const handleStar = async (docId: string) => {
    if (!user) {
      await signInWithGithub();
      return;
    }

    if (starringDocId === docId) return;

    setStarringDocId(docId);
    try {
      const result = await docService.toggleStar(docId, user.id);
      
      // Update docs list optimistically
      setDocs(prevDocs => 
        prevDocs.map(doc => {
          if (doc.id === docId) {
            return {
              ...doc,
              is_starred: result.starred,
              stars: result.starCount
            };
          }
          return doc;
        })
      );

      // Update selected doc if it matches
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc(prev => prev ? {
          ...prev,
          is_starred: result.starred,
          stars: result.starCount
        } : null);
      }
    } catch (error) {
      console.error('Failed to toggle star:', error);
    } finally {
      setStarringDocId(null);
    }
  };

  // Handle document download
  const handleDownload = async (docId: string) => {
    try {
      const result = await docService.downloadDocument(docId, user?.id);
      
      // Create download link
      const blob = new Blob([result.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Update download count optimistically
      setDocs(prevDocs => 
        prevDocs.map(doc => 
          doc.id === docId 
            ? { ...doc, downloads: doc.downloads + 1 }
            : doc
        )
      );
    } catch (error) {
      console.error('Failed to download document:', error);
    }
  };

  // Filter tags for mobile view
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );

  if (showProfile && user) {
    return (
      <UserProfile
        username={user.username}
        onEdit={onEdit}
        onBack={() => setShowProfile(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
                CLAUDE.md Hub
              </h1>
              {user && (
                <button
                  onClick={() => setShowProfile(true)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {user.avatar_url && (
                    <img 
                      src={user.avatar_url} 
                      alt={user.username}
                      className="w-5 h-5 rounded-full"
                    />
                  )}
                  @{user.username}
                </button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {user ? (
                <button
                  onClick={onCreateNew}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <span className="text-lg">+</span>
                  Create CLAUDE.md
                </button>
              ) : (
                <button
                  onClick={() => signInWithGithub()}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  Sign in with GitHub
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-4 flex flex-col lg:flex-row gap-4">
            {/* Search Bar */}
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search CLAUDE.md documents..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>

            {/* Sort and View Controls */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="created_at">Latest</option>
                <option value="stars">Most Starred</option>
                <option value="views">Most Viewed</option>
                <option value="downloads">Most Downloaded</option>
              </select>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 text-sm border-l border-gray-300 ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'bg-white text-gray-600'}`}
                >
                  List
                </button>
              </div>

              <button
                onClick={() => setShowMobileFilters(!showMobileFilters)}
                className="lg:hidden px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Tags Sidebar */}
          <div className={`lg:w-64 ${showMobileFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-lg shadow-sm border p-4 sticky top-24">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">Tags</h3>
                <button
                  onClick={() => setShowTagsPanel(!showTagsPanel)}
                  className="lg:hidden text-gray-500"
                >
                  {showTagsPanel ? '−' : '+'}
                </button>
              </div>

              <div className={`${showTagsPanel ? 'block' : 'hidden lg:block'}`}>
                {/* Tag Search */}
                <input
                  type="text"
                  placeholder="Search tags..."
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />

                {/* Selected Tags */}
                {selectedTags.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-gray-500 mb-2">Selected</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedTags.map(tag => (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-200 transition-colors"
                        >
                          {tag}
                          <span className="text-blue-500">×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Tags */}
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {filteredTags.slice(0, 20).map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.name)}
                      className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center justify-between ${
                        selectedTags.includes(tag.name)
                          ? 'bg-blue-50 text-blue-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <span>{tag.name}</span>
                      <span className="text-xs text-gray-500">{tag.doc_count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-gray-600">
                {loading ? 'Loading...' : `${total} document${total !== 1 ? 's' : ''} found`}
              </div>
            </div>

            {/* Documents Grid/List */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : docs.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📄</div>
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  No documents found
                </h3>
                <p className="text-gray-600 mb-4">
                  Try adjusting your search or filters, or create the first document!
                </p>
                {user && (
                  <button
                    onClick={onCreateNew}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Create CLAUDE.md
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={`grid gap-6 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' 
                    : 'grid-cols-1'
                }`}>
                  {docs.map(doc => (
                    <div key={doc.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                            {doc.title}
                          </h3>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => handleStar(doc.id)}
                              disabled={starringDocId === doc.id}
                              className={`p-1.5 rounded transition-colors ${
                                doc.is_starred
                                  ? 'text-yellow-500 hover:text-yellow-600'
                                  : 'text-gray-400 hover:text-yellow-500'
                              } ${starringDocId === doc.id ? 'opacity-50' : ''}`}
                            >
                              <span className="text-sm">★</span>
                            </button>
                            <button
                              onClick={() => handleDownload(doc.id)}
                              className="p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors"
                            >
                              <span className="text-sm">⬇</span>
                            </button>
                          </div>
                        </div>

                        {doc.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                            {doc.description}
                          </p>
                        )}

                        {/* Tags */}
                        {doc.tag_names.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {doc.tag_names.slice(0, 4).map(tag => (
                              <span 
                                key={tag}
                                className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                              >
                                {tag}
                              </span>
                            ))}
                            {doc.tag_names.length > 4 && (
                              <span className="text-gray-500 text-xs px-1">
                                +{doc.tag_names.length - 4}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Author and Stats */}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>by @{doc.author_username}</span>
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
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center mt-8 gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Previous
                    </button>
                    
                    <span className="px-4 py-2 text-sm text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};