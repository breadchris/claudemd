// data/SupabaseClient.ts
import { createClient } from "@supabase/supabase-js";
var SUPABASE_URL = "https://qxbfhpisnafbwtrhekyn.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4YmZocGlzbmFmYnd0cmhla3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNDkyOTcsImV4cCI6MjA2NjcyNTI5N30.VboPHSbBC6XERXMKbxRLe_NhjzhjRYfctwBPzpz1eAo";
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing Supabase configuration: SUPABASE_URL and SUPABASE_ANON_KEY are required");
}
var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});
var getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("Error getting current user:", error);
    throw error;
  }
  return user;
};
var getCurrentSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error("Error getting current session:", error);
    throw error;
  }
  return session;
};

// data/ClaudeDocRepository.ts
var ClaudeDocRepository = class {
  /**
   * Get all public documents with pagination and filtering
   */
  async getPublicDocs(params = {}) {
    const {
      query,
      tags = [],
      page = 1,
      per_page = 20,
      sort_by = "created_at"
    } = params;
    let supabaseQuery = supabase.from("claude_docs").select(`
        *,
        users!inner(username, avatar_url),
        claude_doc_tags!inner(tags!inner(name))
      `).eq("is_public", true);
    if (query) {
      supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    }
    if (tags.length > 0) {
      supabaseQuery = supabaseQuery.in("claude_doc_tags.tags.name", tags);
    }
    const sortOrder = sort_by === "created_at" ? "desc" : "desc";
    supabaseQuery = supabaseQuery.order(sort_by, { ascending: false });
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;
    supabaseQuery = supabaseQuery.range(from, to);
    const { data, error, count } = await supabaseQuery;
    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }
    const docs = (data || []).map((doc) => this.transformToResponse(doc));
    const total = count || 0;
    const total_pages = Math.ceil(total / per_page);
    return {
      docs,
      total,
      page,
      per_page,
      total_pages
    };
  }
  /**
   * Get a single document by ID
   */
  async getById(id, userId) {
    const { data, error } = await supabase.from("claude_docs").select(`
        *,
        users!inner(username, avatar_url),
        claude_doc_tags(tags(name)),
        claude_doc_stars(user_id)
      `).eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch document: ${error.message}`);
    }
    if (!data.is_public && data.user_id !== userId) {
      return null;
    }
    return this.transformToResponse(data, userId);
  }
  /**
   * Create a new document
   */
  async create(doc, userId) {
    const { data, error } = await supabase.from("claude_docs").insert({
      title: doc.title,
      description: doc.description,
      content: doc.content,
      user_id: userId,
      is_public: doc.is_public
    }).select(`
        *,
        users!inner(username, avatar_url)
      `).single();
    if (error) {
      throw new Error(`Failed to create document: ${error.message}`);
    }
    if (doc.tag_names.length > 0) {
      await this.assignTags(data.id, doc.tag_names, userId);
    }
    return this.transformToResponse(data, userId);
  }
  /**
   * Update an existing document
   */
  async update(id, doc, userId) {
    const existing = await this.getById(id, userId);
    if (!existing || existing.user_id !== userId) {
      throw new Error("Document not found or access denied");
    }
    const { data, error } = await supabase.from("claude_docs").update({
      title: doc.title,
      description: doc.description,
      content: doc.content,
      is_public: doc.is_public,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).eq("user_id", userId).select(`
        *,
        users!inner(username, avatar_url)
      `).single();
    if (error) {
      throw new Error(`Failed to update document: ${error.message}`);
    }
    await this.assignTags(id, doc.tag_names, userId);
    return this.transformToResponse(data, userId);
  }
  /**
   * Delete a document
   */
  async delete(id, userId) {
    const { error } = await supabase.from("claude_docs").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to delete document: ${error.message}`);
    }
    return true;
  }
  /**
   * Get documents by user
   */
  async getByUserId(userId) {
    const { data, error } = await supabase.from("claude_docs").select(`
        *,
        users!inner(username, avatar_url),
        claude_doc_tags(tags(name)),
        claude_doc_stars(user_id)
      `).eq("user_id", userId).order("created_at", { ascending: false });
    if (error) {
      throw new Error(`Failed to fetch user documents: ${error.message}`);
    }
    return (data || []).map((doc) => this.transformToResponse(doc, userId));
  }
  /**
   * Increment view count
   */
  async incrementViews(id) {
    const { error } = await supabase.rpc("increment_views", { doc_id: id });
    if (error) {
      const { error: updateError } = await supabase.from("claude_docs").update({ views: supabase.raw("views + 1") }).eq("id", id);
      if (updateError) {
        console.error("Failed to increment views:", updateError);
      }
    }
  }
  /**
   * Increment download count
   */
  async incrementDownloads(id) {
    const { error } = await supabase.rpc("increment_downloads", { doc_id: id });
    if (error) {
      const { error: updateError } = await supabase.from("claude_docs").update({ downloads: supabase.raw("downloads + 1") }).eq("id", id);
      if (updateError) {
        console.error("Failed to increment downloads:", updateError);
      }
    }
  }
  /**
   * Toggle document visibility
   */
  async toggleVisibility(id, userId) {
    const { data: currentDoc, error: fetchError } = await supabase.from("claude_docs").select("is_public").eq("id", id).eq("user_id", userId).single();
    if (fetchError) {
      throw new Error(`Failed to fetch document: ${fetchError.message}`);
    }
    const newVisibility = !currentDoc.is_public;
    const { error } = await supabase.from("claude_docs").update({
      is_public: newVisibility,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to update visibility: ${error.message}`);
    }
    return newVisibility;
  }
  /**
   * Assign tags to a document
   */
  async assignTags(docId, tagNames, userId) {
    await supabase.from("claude_doc_tags").delete().eq("claude_doc_id", docId);
    for (const tagName of tagNames) {
      if (!tagName.trim()) continue;
      let { data: tag, error } = await supabase.from("tags").select("id").eq("name", tagName).single();
      if (error && error.code === "PGRST116") {
        const { data: newTag, error: createError } = await supabase.from("tags").insert({
          name: tagName,
          user_id: userId
        }).select("id").single();
        if (createError) {
          console.error(`Failed to create tag ${tagName}:`, createError);
          continue;
        }
        tag = newTag;
      } else if (error) {
        console.error(`Failed to find tag ${tagName}:`, error);
        continue;
      }
      await supabase.from("claude_doc_tags").insert({
        claude_doc_id: docId,
        tag_id: tag.id
      });
    }
  }
  /**
   * Transform database result to response format
   */
  transformToResponse(data, currentUserId) {
    const tagNames = data.claude_doc_tags?.map((cdt) => cdt.tags?.name).filter(Boolean) || [];
    const isStarred = currentUserId ? data.claude_doc_stars?.some((star) => star.user_id === currentUserId) || false : false;
    return {
      id: data.id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      title: data.title,
      description: data.description,
      content: data.content,
      user_id: data.user_id,
      is_public: data.is_public,
      downloads: data.downloads,
      stars: data.stars,
      views: data.views,
      author_name: data.users?.username || "Unknown",
      author_username: data.users?.username || "Unknown",
      is_starred: isStarred,
      tag_names: tagNames
    };
  }
};

// data/StarRepository.ts
var StarRepository = class {
  /**
   * Star a document
   */
  async starDocument(docId, userId) {
    const { data: existingStar, error: checkError } = await supabase.from("claude_doc_stars").select("id").eq("claude_doc_id", docId).eq("user_id", userId).single();
    if (checkError && checkError.code !== "PGRST116") {
      throw new Error(`Failed to check star status: ${checkError.message}`);
    }
    if (existingStar) {
      return true;
    }
    const { error } = await supabase.from("claude_doc_stars").insert({
      claude_doc_id: docId,
      user_id: userId
    });
    if (error) {
      throw new Error(`Failed to star document: ${error.message}`);
    }
    return true;
  }
  /**
   * Unstar a document
   */
  async unstarDocument(docId, userId) {
    const { error } = await supabase.from("claude_doc_stars").delete().eq("claude_doc_id", docId).eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to unstar document: ${error.message}`);
    }
    return true;
  }
  /**
   * Toggle star status for a document
   */
  async toggleStar(docId, userId) {
    const { data: existingStar, error: checkError } = await supabase.from("claude_doc_stars").select("id").eq("claude_doc_id", docId).eq("user_id", userId).single();
    if (checkError && checkError.code !== "PGRST116") {
      throw new Error(`Failed to check star status: ${checkError.message}`);
    }
    if (existingStar) {
      await this.unstarDocument(docId, userId);
      return false;
    } else {
      await this.starDocument(docId, userId);
      return true;
    }
  }
  /**
   * Check if a document is starred by a user
   */
  async isStarred(docId, userId) {
    const { data, error } = await supabase.from("claude_doc_stars").select("id").eq("claude_doc_id", docId).eq("user_id", userId).single();
    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to check star status: ${error.message}`);
    }
    return !!data;
  }
  /**
   * Get all starred documents for a user
   */
  async getStarredDocuments(userId) {
    const { data, error } = await supabase.from("claude_doc_stars").select("claude_doc_id").eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to fetch starred documents: ${error.message}`);
    }
    return (data || []).map((star) => star.claude_doc_id);
  }
  /**
   * Get star count for a document
   */
  async getStarCount(docId) {
    const { count, error } = await supabase.from("claude_doc_stars").select("*", { count: "exact", head: true }).eq("claude_doc_id", docId);
    if (error) {
      throw new Error(`Failed to get star count: ${error.message}`);
    }
    return count || 0;
  }
  /**
   * Get users who starred a document
   */
  async getStarredByUsers(docId) {
    const { data, error } = await supabase.from("claude_doc_stars").select(`
        user_id,
        users!inner(username)
      `).eq("claude_doc_id", docId);
    if (error) {
      throw new Error(`Failed to fetch starring users: ${error.message}`);
    }
    return (data || []).map((star) => ({
      id: star.user_id,
      username: star.users.username
    }));
  }
  /**
   * Get star statistics for multiple documents
   */
  async getStarStats(docIds, userId) {
    const { data, error } = await supabase.from("claude_doc_stars").select("claude_doc_id, user_id").in("claude_doc_id", docIds);
    if (error) {
      throw new Error(`Failed to fetch star stats: ${error.message}`);
    }
    const stats = {};
    docIds.forEach((docId) => {
      stats[docId] = { count: 0, isStarred: false };
    });
    (data || []).forEach((star) => {
      stats[star.claude_doc_id].count++;
      if (userId && star.user_id === userId) {
        stats[star.claude_doc_id].isStarred = true;
      }
    });
    return stats;
  }
};

// data/TagRepository.ts
var TagRepository = class {
  /**
   * Get all tags
   */
  async getAll() {
    const { data, error } = await supabase.from("tags").select("*").order("name");
    if (error) {
      throw new Error(`Failed to fetch tags: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Get tags with usage count
   */
  async getTagsWithCount() {
    const { data, error } = await supabase.from("tags").select(`
        *,
        claude_doc_tags(claude_doc_id)
      `).order("name");
    if (error) {
      throw new Error(`Failed to fetch tags with count: ${error.message}`);
    }
    return (data || []).map((tag) => ({
      ...tag,
      doc_count: tag.claude_doc_tags?.length || 0
    }));
  }
  /**
   * Get popular tags (most used)
   */
  async getPopularTags(limit = 20) {
    const tagsWithCount = await this.getTagsWithCount();
    return tagsWithCount.sort((a, b) => b.doc_count - a.doc_count).slice(0, limit);
  }
  /**
   * Search tags by name
   */
  async searchByName(query) {
    const { data, error } = await supabase.from("tags").select("*").ilike("name", `%${query}%`).order("name").limit(50);
    if (error) {
      throw new Error(`Failed to search tags: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Get tag by name
   */
  async getByName(name) {
    const { data, error } = await supabase.from("tags").select("*").eq("name", name).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch tag: ${error.message}`);
    }
    return data;
  }
  /**
   * Get tag by ID
   */
  async getById(id) {
    const { data, error } = await supabase.from("tags").select("*").eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch tag: ${error.message}`);
    }
    return data;
  }
  /**
   * Create a new tag
   */
  async create(name, userId, color) {
    const { data, error } = await supabase.from("tags").insert({
      name: name.toLowerCase().trim(),
      color,
      user_id: userId
    }).select("*").single();
    if (error) {
      throw new Error(`Failed to create tag: ${error.message}`);
    }
    return data;
  }
  /**
   * Find or create a tag by name
   */
  async findOrCreate(name, userId, color) {
    const normalizedName = name.toLowerCase().trim();
    let tag = await this.getByName(normalizedName);
    if (!tag) {
      tag = await this.create(normalizedName, userId, color);
    }
    return tag;
  }
  /**
   * Update a tag
   */
  async update(id, updates, userId) {
    const { data, error } = await supabase.from("tags").update({
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).eq("user_id", userId).select("*").single();
    if (error) {
      throw new Error(`Failed to update tag: ${error.message}`);
    }
    return data;
  }
  /**
   * Delete a tag (only if not used by any documents)
   */
  async delete(id, userId) {
    const { count, error: countError } = await supabase.from("claude_doc_tags").select("*", { count: "exact", head: true }).eq("tag_id", id);
    if (countError) {
      throw new Error(`Failed to check tag usage: ${countError.message}`);
    }
    if (count && count > 0) {
      throw new Error("Cannot delete tag that is being used by documents");
    }
    const { error } = await supabase.from("tags").delete().eq("id", id).eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to delete tag: ${error.message}`);
    }
    return true;
  }
  /**
   * Get tags for a specific document
   */
  async getDocumentTags(docId) {
    const { data, error } = await supabase.from("claude_doc_tags").select(`
        tags(*)
      `).eq("claude_doc_id", docId);
    if (error) {
      throw new Error(`Failed to fetch document tags: ${error.message}`);
    }
    return (data || []).map((item) => item.tags).filter(Boolean);
  }
  /**
   * Get documents for a specific tag
   */
  async getTagDocuments(tagId) {
    const { data, error } = await supabase.from("claude_doc_tags").select("claude_doc_id").eq("tag_id", tagId);
    if (error) {
      throw new Error(`Failed to fetch tag documents: ${error.message}`);
    }
    return (data || []).map((item) => item.claude_doc_id);
  }
  /**
   * Get tags created by a user
   */
  async getUserTags(userId) {
    const { data, error } = await supabase.from("tags").select("*").eq("user_id", userId).order("name");
    if (error) {
      throw new Error(`Failed to fetch user tags: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Bulk find or create tags
   */
  async bulkFindOrCreate(tagNames, userId) {
    const results = [];
    for (const name of tagNames) {
      if (name.trim()) {
        try {
          const tag = await this.findOrCreate(name, userId);
          results.push(tag);
        } catch (error) {
          console.error(`Failed to create tag ${name}:`, error);
        }
      }
    }
    return results;
  }
};

// data/UserRepository.ts
var UserRepository = class {
  /**
   * Get user by ID
   */
  async getById(id) {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    return data;
  }
  /**
   * Get user by username
   */
  async getByUsername(username) {
    const { data, error } = await supabase.from("users").select("*").eq("username", username).single();
    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    return data;
  }
  /**
   * Create a new user profile
   */
  async create(userData) {
    const { data, error } = await supabase.from("users").insert({
      id: userData.id,
      username: userData.username,
      email: userData.email,
      avatar_url: userData.avatar_url
    }).select("*").single();
    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
    return data;
  }
  /**
   * Update user profile
   */
  async update(id, updates) {
    const { data, error } = await supabase.from("users").update({
      ...updates,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", id).select("*").single();
    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    return data;
  }
  /**
   * Delete user profile
   */
  async delete(id) {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
    return true;
  }
  /**
   * Check if username is available
   */
  async isUsernameAvailable(username, excludeUserId) {
    let query = supabase.from("users").select("id").eq("username", username);
    if (excludeUserId) {
      query = query.neq("id", excludeUserId);
    }
    const { data, error } = await query.single();
    if (error && error.code === "PGRST116") {
      return true;
    }
    if (error) {
      throw new Error(`Failed to check username availability: ${error.message}`);
    }
    return !data;
  }
  /**
   * Search users by username
   */
  async searchByUsername(query, limit = 20) {
    const { data, error } = await supabase.from("users").select("*").ilike("username", `%${query}%`).order("username").limit(limit);
    if (error) {
      throw new Error(`Failed to search users: ${error.message}`);
    }
    return data || [];
  }
  /**
   * Get user stats (document counts, etc.)
   */
  async getUserStats(userId) {
    const { data, error } = await supabase.from("claude_docs").select("is_public, stars, views, downloads").eq("user_id", userId);
    if (error) {
      throw new Error(`Failed to fetch user stats: ${error.message}`);
    }
    const docs = data || [];
    return {
      total_docs: docs.length,
      public_docs: docs.filter((doc) => doc.is_public).length,
      private_docs: docs.filter((doc) => !doc.is_public).length,
      total_stars: docs.reduce((sum, doc) => sum + doc.stars, 0),
      total_views: docs.reduce((sum, doc) => sum + doc.views, 0),
      total_downloads: docs.reduce((sum, doc) => sum + doc.downloads, 0)
    };
  }
  /**
   * Get top contributors (users with most public documents)
   */
  async getTopContributors(limit = 10) {
    const { data, error } = await supabase.from("users").select(`
        *,
        claude_docs!inner(id)
      `).eq("claude_docs.is_public", true).order("claude_docs(count)", { ascending: false }).limit(limit);
    if (error) {
      throw new Error(`Failed to fetch top contributors: ${error.message}`);
    }
    return (data || []).map((user) => ({
      ...user,
      doc_count: user.claude_docs?.length || 0
    }));
  }
  /**
   * Find or create user from auth user
   */
  async findOrCreateFromAuth(authUser) {
    let user = await this.getById(authUser.id);
    if (!user) {
      const username = authUser.user_metadata?.user_name || authUser.user_metadata?.username || authUser.user_metadata?.full_name || `user_${authUser.id.slice(0, 8)}`;
      let finalUsername = username;
      let counter = 1;
      while (!await this.isUsernameAvailable(finalUsername)) {
        finalUsername = `${username}_${counter}`;
        counter++;
      }
      user = await this.create({
        id: authUser.id,
        username: finalUsername,
        email: authUser.email,
        avatar_url: authUser.user_metadata?.avatar_url
      });
    }
    return user;
  }
  /**
   * Get recent activity for a user (recent documents)
   */
  async getRecentActivity(userId, limit = 10) {
    const { data, error } = await supabase.from("claude_docs").select("id, title, created_at, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(limit);
    if (error) {
      throw new Error(`Failed to fetch recent activity: ${error.message}`);
    }
    return (data || []).map((doc) => ({
      id: doc.id,
      title: doc.title,
      created_at: doc.updated_at,
      action: doc.created_at === doc.updated_at ? "created" : "updated"
    }));
  }
};

// services/ClaudeDocService.ts
var ClaudeDocService = class {
  constructor() {
    this.docRepo = new ClaudeDocRepository();
    this.starRepo = new StarRepository();
    this.tagRepo = new TagRepository();
  }
  /**
   * Get public documents with enhanced search and filtering
   */
  async getPublicDocs(params = {}) {
    const sanitizedParams = this.sanitizeSearchParams(params);
    return await this.docRepo.getPublicDocs(sanitizedParams);
  }
  /**
   * Get a document by ID with view tracking
   */
  async getDocument(id, userId, incrementView = true) {
    if (!this.isValidUUID(id)) {
      throw new Error("Invalid document ID format");
    }
    const doc = await this.docRepo.getById(id, userId);
    if (doc && incrementView) {
      this.docRepo.incrementViews(id).catch((error) => {
        console.error("Failed to increment view count:", error);
      });
    }
    return doc;
  }
  /**
   * Create a new document with validation
   */
  async createDocument(doc, userId) {
    if (!userId) {
      throw new Error("User must be authenticated to create documents");
    }
    this.validateDocumentData(doc);
    const sanitizedDoc = {
      ...doc,
      tag_names: this.sanitizeTagNames(doc.tag_names),
      title: doc.title.trim(),
      description: doc.description?.trim() || "",
      content: doc.content.trim()
    };
    return await this.docRepo.create(sanitizedDoc, userId);
  }
  /**
   * Update a document with validation
   */
  async updateDocument(id, doc, userId) {
    if (!userId) {
      throw new Error("User must be authenticated to update documents");
    }
    if (!this.isValidUUID(id)) {
      throw new Error("Invalid document ID format");
    }
    this.validateDocumentData(doc);
    const sanitizedDoc = {
      ...doc,
      tag_names: this.sanitizeTagNames(doc.tag_names),
      title: doc.title.trim(),
      description: doc.description?.trim() || "",
      content: doc.content.trim()
    };
    return await this.docRepo.update(id, sanitizedDoc, userId);
  }
  /**
   * Delete a document
   */
  async deleteDocument(id, userId) {
    if (!userId) {
      throw new Error("User must be authenticated to delete documents");
    }
    if (!this.isValidUUID(id)) {
      throw new Error("Invalid document ID format");
    }
    return await this.docRepo.delete(id, userId);
  }
  /**
   * Toggle star status for a document
   */
  async toggleStar(docId, userId) {
    if (!userId) {
      throw new Error("User must be authenticated to star documents");
    }
    if (!this.isValidUUID(docId)) {
      throw new Error("Invalid document ID format");
    }
    const isStarred = await this.starRepo.toggleStar(docId, userId);
    const starCount = await this.starRepo.getStarCount(docId);
    return {
      starred: isStarred,
      starCount
    };
  }
  /**
   * Download a document (increment download count and return content)
   */
  async downloadDocument(id, userId) {
    if (!this.isValidUUID(id)) {
      throw new Error("Invalid document ID format");
    }
    const doc = await this.docRepo.getById(id, userId);
    if (!doc) {
      throw new Error("Document not found or access denied");
    }
    this.docRepo.incrementDownloads(id).catch((error) => {
      console.error("Failed to increment download count:", error);
    });
    return {
      content: doc.content,
      filename: `${this.sanitizeFilename(doc.title)}.md`
    };
  }
  /**
   * Toggle document visibility
   */
  async toggleVisibility(id, userId) {
    if (!userId) {
      throw new Error("User must be authenticated to change document visibility");
    }
    if (!this.isValidUUID(id)) {
      throw new Error("Invalid document ID format");
    }
    const isPublic = await this.docRepo.toggleVisibility(id, userId);
    return { isPublic };
  }
  /**
   * Get user's documents
   */
  async getUserDocuments(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }
    return await this.docRepo.getByUserId(userId);
  }
  /**
   * Search documents with advanced filtering
   */
  async searchDocuments(params) {
    const sanitizedParams = this.sanitizeSearchParams(params);
    return await this.docRepo.getPublicDocs(sanitizedParams);
  }
  /**
   * Get document statistics
   */
  async getDocumentStats(docId) {
    if (!this.isValidUUID(docId)) {
      throw new Error("Invalid document ID format");
    }
    const doc = await this.docRepo.getById(docId);
    if (!doc) {
      throw new Error("Document not found");
    }
    return {
      views: doc.views,
      downloads: doc.downloads,
      stars: doc.stars,
      tagCount: doc.tag_names.length
    };
  }
  /**
   * Get trending documents (most viewed/starred recently)
   */
  async getTrendingDocuments(limit = 10) {
    const result = await this.docRepo.getPublicDocs({
      sort_by: "views",
      per_page: limit,
      page: 1
    });
    return result.docs;
  }
  // Private helper methods
  validateDocumentData(doc) {
    if (!doc.title || doc.title.trim().length === 0) {
      throw new Error("Document title is required");
    }
    if (doc.title.trim().length > 200) {
      throw new Error("Document title must be 200 characters or less");
    }
    if (!doc.content || doc.content.trim().length === 0) {
      throw new Error("Document content is required");
    }
    if (doc.content.length > 1e6) {
      throw new Error("Document content is too large (max 1MB)");
    }
    if (doc.description && doc.description.length > 500) {
      throw new Error("Document description must be 500 characters or less");
    }
    if (doc.tag_names.length > 10) {
      throw new Error("Maximum of 10 tags allowed per document");
    }
  }
  sanitizeSearchParams(params) {
    return {
      query: params.query?.trim().slice(0, 100),
      // Limit query length
      tags: params.tags?.slice(0, 5),
      // Limit to 5 tags max
      page: Math.max(1, params.page || 1),
      per_page: Math.min(50, Math.max(1, params.per_page || 20)),
      // Limit between 1-50
      sort_by: ["created_at", "stars", "views", "downloads"].includes(params.sort_by || "") ? params.sort_by : "created_at"
    };
  }
  sanitizeTagNames(tagNames) {
    return tagNames.map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0 && tag.length <= 50).filter((tag, index, arr) => arr.indexOf(tag) === index).slice(0, 10);
  }
  sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9\s\-_]/g, "").replace(/\s+/g, "_").slice(0, 100);
  }
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
};

// services/AuthService.ts
var AuthService = class {
  constructor() {
    this.userRepo = new UserRepository();
  }
  /**
   * Sign in with GitHub OAuth
   */
  async signInWithGithub(redirectTo) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: redirectTo || window.location.origin
      }
    });
    if (error) {
      console.error("GitHub sign-in error:", error);
      return { error };
    }
    return { error: void 0 };
  }
  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign-out error:", error);
      return { error };
    }
    return { error: void 0 };
  }
  /**
   * Get current user session
   */
  async getCurrentSession() {
    return await getCurrentSession();
  }
  /**
   * Get current authenticated user
   */
  async getCurrentUser() {
    return await getCurrentUser();
  }
  /**
   * Get current user profile
   */
  async getCurrentUserProfile() {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return null;
    }
    return await this.userRepo.getById(authUser.id);
  }
  /**
   * Create or update user profile from auth user
   */
  async syncUserProfile(authUser) {
    return await this.userRepo.findOrCreateFromAuth({
      id: authUser.id,
      email: authUser.email,
      user_metadata: authUser.user_metadata
    });
  }
  /**
   * Update user profile
   */
  async updateProfile(updates) {
    const authUser = await getCurrentUser();
    if (!authUser) {
      throw new Error("User not authenticated");
    }
    if (updates.username) {
      await this.validateUsername(updates.username, authUser.id);
    }
    return await this.userRepo.update(authUser.id, updates);
  }
  /**
   * Check if username is available
   */
  async isUsernameAvailable(username, excludeUserId) {
    if (!this.isValidUsername(username)) {
      return false;
    }
    return await this.userRepo.isUsernameAvailable(username, excludeUserId);
  }
  /**
   * Generate a unique username suggestion
   */
  async generateUniqueUsername(baseUsername) {
    let username = this.sanitizeUsername(baseUsername);
    let counter = 1;
    while (!await this.isUsernameAvailable(username)) {
      username = `${this.sanitizeUsername(baseUsername)}_${counter}`;
      counter++;
    }
    return username;
  }
  /**
   * Validate and sanitize username
   */
  async validateUsername(username, excludeUserId) {
    if (!this.isValidUsername(username)) {
      throw new Error("Username must be 3-30 characters long and contain only letters, numbers, underscores, and hyphens");
    }
    const isAvailable = await this.isUsernameAvailable(username, excludeUserId);
    if (!isAvailable) {
      throw new Error("Username is already taken");
    }
  }
  /**
   * Check if username format is valid
   */
  isValidUsername(username) {
    if (!username || username.length < 3 || username.length > 30) {
      return false;
    }
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return false;
    }
    if (username.startsWith("_") || username.startsWith("-") || username.endsWith("_") || username.endsWith("-")) {
      return false;
    }
    if (username.includes("__") || username.includes("--") || username.includes("_-") || username.includes("-_")) {
      return false;
    }
    return true;
  }
  /**
   * Sanitize username by removing invalid characters
   */
  sanitizeUsername(username) {
    return username.toLowerCase().replace(/[^a-zA-Z0-9_-]/g, "").replace(/^[_-]+|[_-]+$/g, "").replace(/[_-]{2,}/g, "_").slice(0, 30);
  }
  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  }
  /**
   * Get user statistics
   */
  async getUserStats(userId) {
    const targetUserId = userId || (await getCurrentUser())?.id;
    if (!targetUserId) {
      throw new Error("User not found");
    }
    return await this.userRepo.getUserStats(targetUserId);
  }
  /**
   * Delete user account and all associated data
   */
  async deleteAccount() {
    const authUser = await getCurrentUser();
    if (!authUser) {
      throw new Error("User not authenticated");
    }
    await this.userRepo.delete(authUser.id);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error signing out after account deletion:", error);
      return { error };
    }
    return { error: void 0 };
  }
  /**
   * Refresh current session
   */
  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      console.error("Session refresh error:", error);
      return { session: null, error };
    }
    return { session: data.session, error: void 0 };
  }
  /**
   * Check if user is authenticated
   */
  async isAuthenticated() {
    const session = await getCurrentSession();
    return !!session;
  }
  /**
   * Get user role/permissions (if implementing role-based access)
   */
  async getUserRole() {
    const authUser = await getCurrentUser();
    if (!authUser) {
      return null;
    }
    return "user";
  }
};

// services/TagService.ts
var PREDEFINED_TAGS = [
  // Languages
  "typescript",
  "javascript",
  "python",
  "golang",
  "rust",
  "java",
  "csharp",
  "ruby",
  "php",
  // Frameworks
  "react",
  "vue",
  "angular",
  "nextjs",
  "svelte",
  "express",
  "fastapi",
  "django",
  "rails",
  "laravel",
  // Infrastructure
  "docker",
  "kubernetes",
  "aws",
  "gcp",
  "azure",
  "terraform",
  "ansible",
  // Databases
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "elasticsearch",
  // Tools
  "git",
  "vscode",
  "intellij",
  "postman",
  "figma",
  "slack",
  // APIs
  "rest",
  "graphql",
  "websocket",
  "grpc",
  "oauth",
  "jwt",
  // Platforms
  "web",
  "mobile",
  "desktop",
  "cli",
  "api",
  "microservices"
];
var TagService = class {
  constructor() {
    this.tagRepo = new TagRepository();
  }
  /**
   * Get all tags with usage statistics
   */
  async getAllTags() {
    return await this.tagRepo.getTagsWithCount();
  }
  /**
   * Get popular tags (most used)
   */
  async getPopularTags(limit = 20) {
    return await this.tagRepo.getPopularTags(limit);
  }
  /**
   * Search tags by name with suggestions
   */
  async searchTags(query) {
    if (!query || query.trim().length === 0) {
      return [];
    }
    const sanitizedQuery = this.sanitizeTagName(query);
    if (sanitizedQuery.length < 2) {
      return [];
    }
    return await this.tagRepo.searchByName(sanitizedQuery);
  }
  /**
   * Get tag suggestions based on query
   */
  async getTagSuggestions(query) {
    const sanitizedQuery = this.sanitizeTagName(query).toLowerCase();
    if (sanitizedQuery.length === 0) {
      return PREDEFINED_TAGS.slice(0, 10);
    }
    const predefinedMatches = PREDEFINED_TAGS.filter((tag) => tag.includes(sanitizedQuery)).slice(0, 5);
    const existingTags = await this.searchTags(sanitizedQuery);
    const existingMatches = existingTags.map((tag) => tag.name).slice(0, 5);
    const allMatches = [...predefinedMatches, ...existingMatches];
    const uniqueMatches = Array.from(new Set(allMatches));
    return uniqueMatches.slice(0, 10);
  }
  /**
   * Get predefined tags for a specific category
   */
  getPredefinedTags() {
    return [...PREDEFINED_TAGS];
  }
  /**
   * Get tags by category
   */
  getTagsByCategory() {
    return {
      languages: [
        "typescript",
        "javascript",
        "python",
        "golang",
        "rust",
        "java",
        "csharp",
        "ruby",
        "php"
      ],
      frameworks: [
        "react",
        "vue",
        "angular",
        "nextjs",
        "svelte",
        "express",
        "fastapi",
        "django",
        "rails",
        "laravel"
      ],
      infrastructure: [
        "docker",
        "kubernetes",
        "aws",
        "gcp",
        "azure",
        "terraform",
        "ansible"
      ],
      databases: [
        "postgresql",
        "mysql",
        "mongodb",
        "redis",
        "elasticsearch"
      ],
      tools: [
        "git",
        "vscode",
        "intellij",
        "postman",
        "figma",
        "slack"
      ],
      apis: [
        "rest",
        "graphql",
        "websocket",
        "grpc",
        "oauth",
        "jwt"
      ],
      platforms: [
        "web",
        "mobile",
        "desktop",
        "cli",
        "api",
        "microservices"
      ]
    };
  }
  /**
   * Validate and sanitize tag names
   */
  validateTagNames(tagNames) {
    const valid = [];
    const invalid = [];
    for (const tagName of tagNames) {
      const sanitized = this.sanitizeTagName(tagName);
      if (this.isValidTagName(sanitized)) {
        valid.push(sanitized);
      } else {
        invalid.push(tagName);
      }
    }
    return { valid, invalid };
  }
  /**
   * Create or find tags from tag names
   */
  async processTagNames(tagNames, userId) {
    const { valid } = this.validateTagNames(tagNames);
    if (valid.length === 0) {
      return [];
    }
    const uniqueTagNames = Array.from(new Set(valid));
    return await this.tagRepo.bulkFindOrCreate(uniqueTagNames, userId);
  }
  /**
   * Get tag details by name
   */
  async getTagByName(name) {
    const sanitizedName = this.sanitizeTagName(name);
    if (!this.isValidTagName(sanitizedName)) {
      return null;
    }
    return await this.tagRepo.getByName(sanitizedName);
  }
  /**
   * Get documents for a tag
   */
  async getTagDocuments(tagId) {
    if (!this.isValidUUID(tagId)) {
      throw new Error("Invalid tag ID format");
    }
    return await this.tagRepo.getTagDocuments(tagId);
  }
  /**
   * Get user's created tags
   */
  async getUserTags(userId) {
    if (!userId) {
      throw new Error("User ID is required");
    }
    return await this.tagRepo.getUserTags(userId);
  }
  /**
   * Delete a tag (if not in use)
   */
  async deleteTag(tagId, userId) {
    if (!this.isValidUUID(tagId)) {
      throw new Error("Invalid tag ID format");
    }
    if (!userId) {
      throw new Error("User must be authenticated to delete tags");
    }
    return await this.tagRepo.delete(tagId, userId);
  }
  /**
   * Get trending tags (recently popular)
   */
  async getTrendingTags(limit = 10) {
    return await this.getPopularTags(limit);
  }
  /**
   * Get recommended tags based on document content
   */
  getRecommendedTags(title, description, content) {
    const text = `${title} ${description} ${content}`.toLowerCase();
    const recommendations = [];
    for (const tag of PREDEFINED_TAGS) {
      if (text.includes(tag)) {
        recommendations.push(tag);
      }
    }
    if (text.includes("react") || text.includes("jsx") || text.includes("tsx")) {
      recommendations.push("react", "javascript", "typescript");
    }
    if (text.includes("api") || text.includes("endpoint") || text.includes("http")) {
      recommendations.push("api", "rest");
    }
    if (text.includes("database") || text.includes("sql") || text.includes("query")) {
      recommendations.push("postgresql", "mysql");
    }
    return Array.from(new Set(recommendations)).slice(0, 5);
  }
  // Private helper methods
  sanitizeTagName(tagName) {
    return tagName.trim().toLowerCase().replace(/[^a-z0-9\-_]/g, "").replace(/^[-_]+|[-_]+$/g, "").replace(/[-_]{2,}/g, "-").slice(0, 50);
  }
  isValidTagName(tagName) {
    if (!tagName || tagName.length < 2 || tagName.length > 50) {
      return false;
    }
    const tagRegex = /^[a-z0-9\-_]+$/;
    if (!tagRegex.test(tagName)) {
      return false;
    }
    if (tagName.startsWith("-") || tagName.startsWith("_") || tagName.endsWith("-") || tagName.endsWith("_")) {
      return false;
    }
    return true;
  }
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }
};

// services/SearchService.ts
var SearchService = class {
  constructor() {
    this.docRepo = new ClaudeDocRepository();
  }
  /**
   * Basic text search across documents
   */
  async searchDocuments(params) {
    const sanitizedParams = this.sanitizeSearchParams(params);
    return await this.docRepo.getPublicDocs(sanitizedParams);
  }
  /**
   * Advanced search with multiple filters
   */
  async advancedSearch(params) {
    const basicParams = {
      query: params.query,
      tags: params.tags,
      page: params.page,
      per_page: params.per_page,
      sort_by: params.sort_by
    };
    return await this.searchDocuments(basicParams);
  }
  /**
   * Search suggestions based on query
   */
  async getSearchSuggestions(query) {
    if (!query || query.trim().length < 2) {
      return [];
    }
    const suggestions = [];
    const commonTerms = [
      "api integration",
      "authentication",
      "configuration",
      "setup guide",
      "getting started",
      "examples",
      "best practices",
      "troubleshooting",
      "deployment",
      "environment variables",
      "webhooks",
      "database",
      "react components",
      "typescript",
      "javascript",
      "python",
      "rest api",
      "graphql",
      "oauth",
      "jwt",
      "docker",
      "kubernetes"
    ];
    const queryLower = query.toLowerCase().trim();
    for (const term of commonTerms) {
      if (term.includes(queryLower) || queryLower.includes(term.split(" ")[0])) {
        suggestions.push(term);
      }
    }
    return suggestions.slice(0, 5);
  }
  /**
   * Get popular search terms
   */
  getPopularSearchTerms() {
    return [
      "react setup",
      "api configuration",
      "authentication guide",
      "typescript examples",
      "database integration",
      "deployment guide",
      "environment setup",
      "oauth implementation",
      "webhook configuration",
      "best practices"
    ];
  }
  /**
   * Search by author username
   */
  async searchByAuthor(username, params = {}) {
    return await this.searchDocuments({
      ...params,
      query: `author:${username}`
      // This would need custom handling in the repository
    });
  }
  /**
   * Get related documents based on tags
   */
  async getRelatedDocuments(tags, excludeDocId, limit = 5) {
    if (tags.length === 0) {
      return {
        docs: [],
        total: 0,
        page: 1,
        per_page: limit,
        total_pages: 0
      };
    }
    return await this.searchDocuments({
      tags: tags.slice(0, 3),
      // Use up to 3 tags for related search
      per_page: limit,
      page: 1,
      sort_by: "stars"
      // Sort by popularity for better recommendations
    });
  }
  /**
   * Full-text search with ranking
   */
  async fullTextSearch(query, params = {}) {
    const searchTerms = this.extractSearchTerms(query);
    if (searchTerms.length === 0) {
      return {
        docs: [],
        total: 0,
        page: 1,
        per_page: params.per_page || 20,
        total_pages: 0
      };
    }
    const searchQuery = searchTerms.join(" ");
    return await this.searchDocuments({
      ...params,
      query: searchQuery
    });
  }
  /**
   * Search within user's own documents (including private)
   */
  async searchUserDocuments(userId, query) {
    return {
      docs: [],
      total: 0,
      page: 1,
      per_page: 20,
      total_pages: 0
    };
  }
  /**
   * Get search analytics/statistics
   */
  getSearchStats() {
    return {
      popularTags: [
        "typescript",
        "react",
        "api",
        "nodejs",
        "python",
        "authentication",
        "database",
        "docker",
        "aws"
      ],
      popularTerms: this.getPopularSearchTerms(),
      recentSearches: []
      // This would be stored and retrieved from user sessions
    };
  }
  // Private helper methods
  sanitizeSearchParams(params) {
    return {
      query: params.query?.trim().slice(0, 200),
      // Limit query length
      tags: params.tags?.slice(0, 5),
      // Limit to 5 tags max
      page: Math.max(1, params.page || 1),
      per_page: Math.min(50, Math.max(1, params.per_page || 20)),
      // Limit between 1-50
      sort_by: ["created_at", "stars", "views", "downloads"].includes(params.sort_by || "") ? params.sort_by : "created_at"
    };
  }
  extractSearchTerms(query) {
    if (!query) return [];
    return query.trim().toLowerCase().split(/\s+/).filter((term) => term.length >= 2).filter((term) => !/^[^a-z0-9]*$/.test(term)).slice(0, 10);
  }
  buildSearchQuery(terms) {
    return terms.join(" ");
  }
  rankResults(results, query) {
    const searchTerms = this.extractSearchTerms(query);
    if (searchTerms.length === 0) {
      return results;
    }
    return results.map((doc) => {
      let score = 0;
      searchTerms.forEach((term) => {
        if (doc.title.toLowerCase().includes(term)) {
          score += 10;
        }
        if (doc.description?.toLowerCase().includes(term)) {
          score += 5;
        }
        if (doc.content.toLowerCase().slice(0, 1e3).includes(term)) {
          score += 1;
        }
        if (doc.tag_names.some((tag) => tag.includes(term))) {
          score += 3;
        }
      });
      return { ...doc, _search_score: score };
    }).sort((a, b) => (b._search_score || 0) - (a._search_score || 0));
  }
};

// auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var AuthContext = createContext(void 0);
var AuthProvider = ({ children }) => {
  const [authState, setAuthState] = useState({
    user: null,
    session: null,
    loading: true,
    error: null
  });
  const authService = new AuthService();
  useEffect(() => {
    initializeAuth();
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        console.log("Auth state changed:", event, session);
        if (session) {
          await handleAuthSession(session);
        } else {
          setAuthState((prev) => ({
            ...prev,
            user: null,
            session: null,
            loading: false,
            error: null
          }));
        }
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  const initializeAuth = async () => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const session = await authService.getCurrentSession();
      if (session) {
        await handleAuthSession(session);
      } else {
        setAuthState((prev) => ({
          ...prev,
          user: null,
          session: null,
          loading: false,
          error: null
        }));
      }
    } catch (error) {
      console.error("Failed to initialize auth:", error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Authentication error"
      }));
    }
  };
  const handleAuthSession = async (session) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const userProfile = await authService.syncUserProfile(session.user);
      setAuthState((prev) => ({
        ...prev,
        user: userProfile,
        session,
        loading: false,
        error: null
      }));
    } catch (error) {
      console.error("Failed to handle auth session:", error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Failed to load user profile"
      }));
    }
  };
  const signInWithGithub = async (redirectTo) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const { error } = await authService.signInWithGithub(redirectTo);
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("GitHub sign-in failed:", error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Sign-in failed"
      }));
      throw error;
    }
  };
  const signOut = async () => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const { error } = await authService.signOut();
      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Sign-out failed:", error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Sign-out failed"
      }));
      throw error;
    }
  };
  const updateProfile = async (updates) => {
    try {
      setAuthState((prev) => ({ ...prev, loading: true, error: null }));
      const updatedUser = await authService.updateProfile(updates);
      setAuthState((prev) => ({
        ...prev,
        user: updatedUser,
        loading: false,
        error: null
      }));
      return updatedUser;
    } catch (error) {
      console.error("Profile update failed:", error);
      setAuthState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : "Profile update failed"
      }));
      throw error;
    }
  };
  const isUsernameAvailable = async (username) => {
    return await authService.isUsernameAvailable(username, authState.user?.id);
  };
  const generateUniqueUsername = async (baseUsername) => {
    return await authService.generateUniqueUsername(baseUsername);
  };
  const getUserStats = async () => {
    return await authService.getUserStats();
  };
  const refreshAuth = async () => {
    await initializeAuth();
  };
  const contextValue = {
    ...authState,
    signInWithGithub,
    signOut,
    updateProfile,
    isUsernameAvailable,
    generateUniqueUsername,
    getUserStats,
    refreshAuth
  };
  return /* @__PURE__ */ jsx(AuthContext.Provider, { value: contextValue, children });
};
var useAuth2 = () => {
  const context = useContext(AuthContext);
  if (context === void 0) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
var RequireAuth = ({
  children,
  fallback = /* @__PURE__ */ jsx("div", { children: "Please sign in to access this page." })
}) => {
  const { user, loading } = useAuth2();
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "flex items-center justify-center py-8", children: /* @__PURE__ */ jsx("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) });
  }
  if (!user) {
    return /* @__PURE__ */ jsx(Fragment, { children: fallback });
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
};
var AuthStatus = () => {
  const { user, loading, error, signInWithGithub, signOut } = useAuth2();
  if (loading) {
    return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
      /* @__PURE__ */ jsx("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" }),
      /* @__PURE__ */ jsx("span", { className: "text-sm text-gray-600", children: "Loading..." })
    ] });
  }
  if (error) {
    return /* @__PURE__ */ jsxs("div", { className: "text-sm text-red-600", children: [
      "Error: ",
      error
    ] });
  }
  if (user) {
    return /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
      user.avatar_url && /* @__PURE__ */ jsx(
        "img",
        {
          src: user.avatar_url,
          alt: user.username,
          className: "w-6 h-6 rounded-full"
        }
      ),
      /* @__PURE__ */ jsxs("span", { className: "text-sm font-medium", children: [
        "@",
        user.username
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          onClick: signOut,
          className: "text-xs text-gray-600 hover:text-gray-800 transition-colors",
          children: "Sign out"
        }
      )
    ] });
  }
  return /* @__PURE__ */ jsxs(
    "button",
    {
      onClick: () => signInWithGithub(),
      className: "bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2",
      children: [
        /* @__PURE__ */ jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" }) }),
        "Sign in with GitHub"
      ]
    }
  );
};

// auth/useAuth.ts
var useIsAuthenticated = () => {
  const { user, loading } = useAuth();
  return !loading && !!user;
};
var useUserId = () => {
  const { user } = useAuth();
  return user?.id || null;
};
var useUsername = () => {
  const { user } = useAuth();
  return user?.username || null;
};
var useIsOwner = (resourceUserId) => {
  const { user } = useAuth();
  return !!user && !!resourceUserId && user.id === resourceUserId;
};

// hooks/useClaudeDocs.ts
import { useState as useState2, useEffect as useEffect2, useCallback } from "react";
var useClaudeDocs = (options = {}) => {
  const { user } = useAuth2();
  const docService = new ClaudeDocService();
  const defaultParams = {
    page: 1,
    per_page: 20,
    sort_by: "created_at",
    ...options.initialParams
  };
  const [docs, setDocs] = useState2([]);
  const [loading, setLoading] = useState2(false);
  const [error, setError] = useState2(null);
  const [total, setTotal] = useState2(0);
  const [currentPage, setCurrentPage] = useState2(defaultParams.page || 1);
  const [totalPages, setTotalPages] = useState2(1);
  const [searchParams, setSearchParamsState] = useState2(defaultParams);
  const loadDocs = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const searchParamsToUse = params || searchParams;
      const response = await docService.getPublicDocs(searchParamsToUse);
      setDocs(response.docs);
      setTotal(response.total);
      setCurrentPage(response.page);
      setTotalPages(response.total_pages);
      if (params) {
        setSearchParamsState(searchParamsToUse);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load documents";
      setError(errorMessage);
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);
  const createDoc = useCallback(async (doc) => {
    if (!user) {
      throw new Error("User must be authenticated to create documents");
    }
    try {
      const newDoc = await docService.createDocument(doc, user.id);
      if (!searchParams.query && (!searchParams.tags || searchParams.tags.length === 0)) {
        setDocs((prev) => [newDoc, ...prev.slice(0, (searchParams.per_page || 20) - 1)]);
        setTotal((prev) => prev + 1);
      }
      return newDoc;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create document";
      setError(errorMessage);
      throw err;
    }
  }, [user, searchParams]);
  const updateDoc = useCallback(async (id, doc) => {
    if (!user) {
      throw new Error("User must be authenticated to update documents");
    }
    try {
      const updatedDoc = await docService.updateDocument(id, doc, user.id);
      setDocs(
        (prev) => prev.map((d) => d.id === id ? updatedDoc : d)
      );
      return updatedDoc;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update document";
      setError(errorMessage);
      throw err;
    }
  }, [user]);
  const deleteDoc = useCallback(async (id) => {
    if (!user) {
      throw new Error("User must be authenticated to delete documents");
    }
    try {
      await docService.deleteDocument(id, user.id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete document";
      setError(errorMessage);
      throw err;
    }
  }, [user]);
  const toggleStar = useCallback(async (id) => {
    if (!user) {
      throw new Error("User must be authenticated to star documents");
    }
    try {
      const result = await docService.toggleStar(id, user.id);
      setDocs(
        (prev) => prev.map(
          (doc) => doc.id === id ? {
            ...doc,
            is_starred: result.starred,
            stars: result.starCount
          } : doc
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to toggle star";
      setError(errorMessage);
      throw err;
    }
  }, [user]);
  const downloadDoc = useCallback(async (id) => {
    try {
      const result = await docService.downloadDocument(id, user?.id);
      const blob = new Blob([result.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDocs(
        (prev) => prev.map(
          (doc) => doc.id === id ? { ...doc, downloads: doc.downloads + 1 } : doc
        )
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to download document";
      setError(errorMessage);
      throw err;
    }
  }, [user]);
  const setSearchParams = useCallback((params) => {
    const newParams = { ...searchParams, ...params, page: 1 };
    setSearchParamsState(newParams);
  }, [searchParams]);
  const resetSearch = useCallback(() => {
    setSearchParamsState(defaultParams);
  }, []);
  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      const newParams = { ...searchParams, page: currentPage + 1 };
      setSearchParamsState(newParams);
    }
  }, [currentPage, totalPages, searchParams]);
  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      const newParams = { ...searchParams, page: currentPage - 1 };
      setSearchParamsState(newParams);
    }
  }, [currentPage, searchParams]);
  const setPage = useCallback((page) => {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      const newParams = { ...searchParams, page };
      setSearchParamsState(newParams);
    }
  }, [currentPage, totalPages, searchParams]);
  useEffect2(() => {
    if (options.autoLoad !== false) {
      loadDocs();
    }
  }, [searchParams, loadDocs, options.autoLoad]);
  return {
    docs,
    loading,
    error,
    total,
    currentPage,
    totalPages,
    searchParams,
    // Actions
    loadDocs,
    createDoc,
    updateDoc,
    deleteDoc,
    toggleStar,
    downloadDoc,
    // Utilities
    setSearchParams,
    resetSearch,
    nextPage,
    prevPage,
    setPage
  };
};

// hooks/useTags.ts
import { useState as useState3, useEffect as useEffect3, useCallback as useCallback2 } from "react";
var useTags = () => {
  const { user } = useAuth2();
  const tagService = new TagService();
  const [tags, setTags] = useState3([]);
  const [loading, setLoading] = useState3(false);
  const [error, setError] = useState3(null);
  const [suggestions, setSuggestions] = useState3([]);
  const loadTags = useCallback2(async () => {
    setLoading(true);
    setError(null);
    try {
      const allTags = await tagService.getAllTags();
      setTags(allTags);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load tags";
      setError(errorMessage);
      console.error("Failed to load tags:", err);
    } finally {
      setLoading(false);
    }
  }, []);
  const searchTags = useCallback2(async (query) => {
    try {
      return await tagService.searchTags(query);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to search tags";
      setError(errorMessage);
      console.error("Failed to search tags:", err);
      return [];
    }
  }, []);
  const getSuggestions = useCallback2(async (query) => {
    try {
      const tagSuggestions = await tagService.getTagSuggestions(query);
      setSuggestions(tagSuggestions);
    } catch (err) {
      console.error("Failed to get tag suggestions:", err);
      setSuggestions([]);
    }
  }, []);
  const createTag = useCallback2(async (name, color) => {
    if (!user) {
      throw new Error("User must be authenticated to create tags");
    }
    try {
      const newTag = await tagService.processTagNames([name], user.id);
      if (newTag.length === 0) {
        throw new Error("Failed to create tag");
      }
      await loadTags();
      return newTag[0];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create tag";
      setError(errorMessage);
      throw err;
    }
  }, [user, loadTags]);
  const deleteTag = useCallback2(async (id) => {
    if (!user) {
      throw new Error("User must be authenticated to delete tags");
    }
    try {
      await tagService.deleteTag(id, user.id);
      setTags((prev) => prev.filter((tag) => tag.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete tag";
      setError(errorMessage);
      throw err;
    }
  }, [user]);
  const validateTagNames = useCallback2((tagNames) => {
    return tagService.validateTagNames(tagNames);
  }, []);
  const getPopularTags = useCallback2(async (limit = 20) => {
    try {
      return await tagService.getPopularTags(limit);
    } catch (err) {
      console.error("Failed to get popular tags:", err);
      return [];
    }
  }, []);
  const getPredefinedTags = useCallback2(() => {
    return tagService.getPredefinedTags();
  }, []);
  const getTagsByCategory = useCallback2(() => {
    return tagService.getTagsByCategory();
  }, []);
  const getRecommendedTags = useCallback2((title, description, content) => {
    return tagService.getRecommendedTags(title, description, content);
  }, []);
  useEffect3(() => {
    loadTags();
  }, [loadTags]);
  return {
    tags,
    loading,
    error,
    suggestions,
    // Actions
    loadTags,
    searchTags,
    getSuggestions,
    createTag,
    deleteTag,
    // Utilities
    validateTagNames,
    getPopularTags,
    getPredefinedTags,
    getTagsByCategory,
    getRecommendedTags
  };
};

// hooks/useSearch.ts
import { useState as useState4, useCallback as useCallback3 } from "react";
var useSearch = () => {
  const searchService = new SearchService();
  const [results, setResults] = useState4(null);
  const [loading, setLoading] = useState4(false);
  const [error, setError] = useState4(null);
  const [suggestions, setSuggestions] = useState4([]);
  const search = useCallback3(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const searchResults = await searchService.searchDocuments(params);
      setResults(searchResults);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Search failed";
      setError(errorMessage);
      console.error("Search failed:", err);
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);
  const getSuggestions = useCallback3(async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const searchSuggestions = await searchService.getSearchSuggestions(query);
      setSuggestions(searchSuggestions);
    } catch (err) {
      console.error("Failed to get search suggestions:", err);
      setSuggestions([]);
    }
  }, []);
  const getPopularTerms = useCallback3(() => {
    return searchService.getPopularSearchTerms();
  }, []);
  const searchByAuthor = useCallback3(async (username, params = {}) => {
    await search({
      ...params,
      query: `author:${username}`
    });
  }, [search]);
  const clearResults = useCallback3(() => {
    setResults(null);
    setError(null);
  }, []);
  const clearError = useCallback3(() => {
    setError(null);
  }, []);
  return {
    results,
    loading,
    error,
    suggestions,
    // Actions
    search,
    getSuggestions,
    getPopularTerms,
    searchByAuthor,
    // Utilities
    clearResults,
    clearError
  };
};

// hooks/useRealtime.ts
import { useState as useState5, useEffect as useEffect4, useCallback as useCallback4 } from "react";
var useRealtime = (options, onEvent) => {
  const [data, setData] = useState5(null);
  const [loading, setLoading] = useState5(false);
  const [error, setError] = useState5(null);
  const [isConnected, setIsConnected] = useState5(false);
  const [subscription, setSubscription] = useState5(null);
  const subscribe = useCallback4(() => {
    if (subscription) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let channel = supabase.channel(`realtime-${options.table}`).on(
        "postgres_changes",
        {
          event: options.event || "*",
          schema: "public",
          table: options.table,
          filter: options.filter
        },
        (payload) => {
          console.log("Realtime event:", payload);
          setData(payload.new || payload.old || null);
          onEvent?.(payload);
        }
      ).subscribe((status) => {
        console.log("Realtime subscription status:", status);
        setIsConnected(status === "SUBSCRIBED");
        setLoading(false);
        if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setError("Realtime connection failed");
        }
      });
      setSubscription(channel);
    } catch (err) {
      console.error("Failed to subscribe to realtime:", err);
      setError(err instanceof Error ? err.message : "Subscription failed");
      setLoading(false);
    }
  }, [options, onEvent, subscription]);
  const unsubscribe = useCallback4(() => {
    if (subscription) {
      supabase.removeChannel(subscription);
      setSubscription(null);
      setIsConnected(false);
      setData(null);
    }
  }, [subscription]);
  useEffect4(() => {
    subscribe();
    return () => {
      unsubscribe();
    };
  }, []);
  return {
    data,
    loading,
    error,
    isConnected,
    subscribe,
    unsubscribe
  };
};
var useDocumentRealtime = (docId, onDocumentUpdate) => {
  return useRealtime(
    {
      table: "claude_docs",
      event: "UPDATE",
      filter: docId ? `id=eq.${docId}` : void 0
    },
    (payload) => {
      if (payload.new && onDocumentUpdate) {
        onDocumentUpdate(payload.new);
      }
    }
  );
};
var useStarRealtime = (docId, onStarChange) => {
  return useRealtime(
    {
      table: "claude_doc_stars",
      event: "*",
      filter: docId ? `claude_doc_id=eq.${docId}` : void 0
    },
    (payload) => {
      if (onStarChange) {
        const event = payload.eventType;
        const star = payload.new || payload.old;
        onStarChange(star, event);
      }
    }
  );
};
var useDocumentListRealtime = (onDocumentChange) => {
  return useRealtime(
    {
      table: "claude_docs",
      event: "*"
    },
    onDocumentChange
  );
};

// components/ClaudeDocApp.tsx
import { useState as useState9 } from "react";

// components/ClaudeDocBrowser.tsx
import { useState as useState7, useEffect as useEffect6, useCallback as useCallback6 } from "react";

// components/UserProfile.tsx
import { useState as useState6, useEffect as useEffect5, useCallback as useCallback5 } from "react";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var UserProfile = ({
  username,
  onEdit,
  onBack
}) => {
  const { user, getUserStats } = useAuth2();
  const docService = new ClaudeDocService();
  const [docs, setDocs] = useState6([]);
  const [loading, setLoading] = useState6(true);
  const [stats, setStats] = useState6({
    total_docs: 0,
    public_docs: 0,
    private_docs: 0,
    total_stars: 0,
    total_views: 0,
    total_downloads: 0
  });
  const loadUserDocs = useCallback5(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userDocs = await docService.getUserDocuments(user.id);
      setDocs(userDocs);
      const userStats = await getUserStats();
      setStats(userStats);
    } catch (error) {
      console.error("Failed to load user documents:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);
  const deleteDoc = useCallback5(async (docId) => {
    if (!user || !confirm("Are you sure you want to delete this document?")) {
      return;
    }
    try {
      await docService.deleteDocument(docId, user.id);
      setDocs((prevDocs) => prevDocs.filter((doc) => doc.id !== docId));
      const userStats = await getUserStats();
      setStats(userStats);
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  }, [user?.id]);
  const toggleVisibility = useCallback5(async (docId) => {
    if (!user) return;
    try {
      const result = await docService.toggleVisibility(docId, user.id);
      setDocs(
        (prevDocs) => prevDocs.map(
          (doc) => doc.id === docId ? { ...doc, is_public: result.isPublic } : doc
        )
      );
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
    }
  }, [user?.id]);
  useEffect5(() => {
    loadUserDocs();
  }, [loadUserDocs]);
  return /* @__PURE__ */ jsxs2("div", { className: "min-h-screen bg-gray-100", children: [
    /* @__PURE__ */ jsx2("div", { className: "bg-white shadow-sm border-b", children: /* @__PURE__ */ jsxs2("div", { className: "w-full px-4 py-4 sm:py-6 sm:px-6 lg:max-w-7xl lg:mx-auto", children: [
      /* @__PURE__ */ jsx2("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: /* @__PURE__ */ jsxs2("div", { className: "flex items-center space-x-3 sm:space-x-4", children: [
        /* @__PURE__ */ jsx2(
          "button",
          {
            onClick: onBack,
            className: "text-gray-500 hover:text-gray-700 text-lg sm:text-xl flex items-center gap-1 hover:bg-gray-100 px-2 py-1 rounded transition-colors",
            children: "\u2190 Back"
          }
        ),
        /* @__PURE__ */ jsxs2("div", { className: "min-w-0 flex-1", children: [
          /* @__PURE__ */ jsxs2("h1", { className: "text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate", children: [
            "@",
            username,
            "'s Profile"
          ] }),
          /* @__PURE__ */ jsx2("p", { className: "text-gray-600 mt-1 text-sm sm:text-base", children: "Manage your CLAUDE.md documents" })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs2("div", { className: "mt-4 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4", children: [
        /* @__PURE__ */ jsxs2("div", { className: "bg-blue-50 rounded-lg p-3 sm:p-4 text-center", children: [
          /* @__PURE__ */ jsx2("div", { className: "text-xl sm:text-2xl font-bold text-blue-600", children: stats.total_docs }),
          /* @__PURE__ */ jsx2("div", { className: "text-xs sm:text-sm text-blue-600", children: "Total Docs" })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "bg-green-50 rounded-lg p-3 sm:p-4 text-center", children: [
          /* @__PURE__ */ jsx2("div", { className: "text-xl sm:text-2xl font-bold text-green-600", children: stats.public_docs }),
          /* @__PURE__ */ jsx2("div", { className: "text-xs sm:text-sm text-green-600", children: "Public" })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "bg-gray-50 rounded-lg p-3 sm:p-4 text-center", children: [
          /* @__PURE__ */ jsx2("div", { className: "text-xl sm:text-2xl font-bold text-gray-600", children: stats.private_docs }),
          /* @__PURE__ */ jsx2("div", { className: "text-xs sm:text-sm text-gray-600", children: "Private" })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "bg-yellow-50 rounded-lg p-3 sm:p-4 text-center", children: [
          /* @__PURE__ */ jsx2("div", { className: "text-xl sm:text-2xl font-bold text-yellow-600", children: stats.total_stars }),
          /* @__PURE__ */ jsx2("div", { className: "text-xs sm:text-sm text-yellow-600", children: "Stars" })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "bg-purple-50 rounded-lg p-3 sm:p-4 text-center", children: [
          /* @__PURE__ */ jsx2("div", { className: "text-xl sm:text-2xl font-bold text-purple-600", children: stats.total_views }),
          /* @__PURE__ */ jsx2("div", { className: "text-xs sm:text-sm text-purple-600", children: "Views" })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "bg-indigo-50 rounded-lg p-3 sm:p-4 text-center", children: [
          /* @__PURE__ */ jsx2("div", { className: "text-xl sm:text-2xl font-bold text-indigo-600", children: stats.total_downloads }),
          /* @__PURE__ */ jsx2("div", { className: "text-xs sm:text-sm text-indigo-600", children: "Downloads" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs2("div", { className: "w-full px-4 py-4 sm:py-6 sm:px-6 lg:max-w-7xl lg:mx-auto", children: [
      loading && /* @__PURE__ */ jsx2("div", { className: "flex items-center justify-center py-12", children: /* @__PURE__ */ jsx2("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) }),
      !loading && docs.length === 0 && /* @__PURE__ */ jsxs2("div", { className: "text-center py-12", children: [
        /* @__PURE__ */ jsx2("div", { className: "text-6xl mb-4", children: "\u{1F4C4}" }),
        /* @__PURE__ */ jsx2("h3", { className: "text-xl font-medium text-gray-900 mb-2", children: "No documents yet" }),
        /* @__PURE__ */ jsx2("p", { className: "text-gray-600", children: "Create your first CLAUDE.md document to get started!" })
      ] }),
      !loading && docs.length > 0 && /* @__PURE__ */ jsxs2("div", { className: "space-y-3 sm:space-y-4", children: [
        /* @__PURE__ */ jsxs2("h2", { className: "text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4", children: [
          "Your Documents (",
          docs.length,
          ")"
        ] }),
        docs.map((doc) => /* @__PURE__ */ jsx2(
          "div",
          {
            className: "bg-white rounded-lg shadow-sm border p-4 sm:p-6",
            children: /* @__PURE__ */ jsxs2("div", { className: "flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4", children: [
              /* @__PURE__ */ jsxs2("div", { className: "flex-1 min-w-0", children: [
                /* @__PURE__ */ jsxs2("div", { className: "flex flex-col sm:flex-row sm:items-center gap-2 mb-2", children: [
                  /* @__PURE__ */ jsx2("h3", { className: "text-base sm:text-lg font-semibold text-gray-900 truncate", children: doc.title }),
                  /* @__PURE__ */ jsx2("span", { className: `px-2 py-1 rounded text-xs self-start sm:self-auto ${doc.is_public ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`, children: doc.is_public ? "Public" : "Private" })
                ] }),
                doc.description && /* @__PURE__ */ jsx2("p", { className: "text-gray-700 text-sm mb-3 line-clamp-2", children: doc.description }),
                doc.tag_names.length > 0 && /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap gap-1 mb-3", children: [
                  doc.tag_names.slice(0, 4).map((tag) => /* @__PURE__ */ jsx2(
                    "span",
                    {
                      className: "bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs",
                      children: tag
                    },
                    tag
                  )),
                  doc.tag_names.length > 4 && /* @__PURE__ */ jsxs2("span", { className: "text-gray-500 text-xs px-1", children: [
                    "+",
                    doc.tag_names.length - 4
                  ] })
                ] }),
                /* @__PURE__ */ jsxs2("div", { className: "flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500", children: [
                  /* @__PURE__ */ jsxs2("span", { className: "inline-flex items-center gap-1", children: [
                    /* @__PURE__ */ jsx2("span", { children: "\u2605" }),
                    " ",
                    doc.stars
                  ] }),
                  /* @__PURE__ */ jsxs2("span", { className: "inline-flex items-center gap-1", children: [
                    /* @__PURE__ */ jsx2("span", { children: "\u{1F441}" }),
                    " ",
                    doc.views
                  ] }),
                  /* @__PURE__ */ jsxs2("span", { className: "inline-flex items-center gap-1", children: [
                    /* @__PURE__ */ jsx2("span", { children: "\u2B07" }),
                    " ",
                    doc.downloads
                  ] }),
                  /* @__PURE__ */ jsxs2("span", { className: "hidden sm:inline", children: [
                    "Created ",
                    new Date(doc.created_at).toLocaleDateString()
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs2("div", { className: "flex flex-col sm:flex-row gap-2 sm:gap-1.5 sm:items-start", children: [
                /* @__PURE__ */ jsx2(
                  "button",
                  {
                    onClick: () => onEdit?.(doc.id),
                    className: "bg-blue-500 text-white px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm hover:bg-blue-600 transition-colors font-medium",
                    children: "Edit"
                  }
                ),
                /* @__PURE__ */ jsx2(
                  "button",
                  {
                    onClick: () => toggleVisibility(doc.id),
                    className: "bg-gray-500 text-white px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm hover:bg-gray-600 transition-colors font-medium",
                    children: doc.is_public ? "Make Private" : "Make Public"
                  }
                ),
                /* @__PURE__ */ jsx2(
                  "button",
                  {
                    onClick: () => deleteDoc(doc.id),
                    className: "bg-red-500 text-white px-3 py-1.5 sm:py-1 rounded-lg text-xs sm:text-sm hover:bg-red-600 transition-colors font-medium",
                    children: "Delete"
                  }
                )
              ] })
            ] })
          },
          doc.id
        ))
      ] })
    ] })
  ] });
};

// components/ClaudeDocBrowser.tsx
import { Fragment as Fragment2, jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var ClaudeDocBrowser = ({
  onCreateNew,
  onEdit
}) => {
  const docService = new ClaudeDocService();
  const tagService = new TagService();
  const searchService = new SearchService();
  const { user, signInWithGithub } = useAuth2();
  const [showProfile, setShowProfile] = useState7(false);
  const [docs, setDocs] = useState7([]);
  const [loading, setLoading] = useState7(true);
  const [searchQuery, setSearchQuery] = useState7("");
  const [selectedTags, setSelectedTags] = useState7([]);
  const [availableTags, setAvailableTags] = useState7([]);
  const [currentPage, setCurrentPage] = useState7(1);
  const [totalPages, setTotalPages] = useState7(1);
  const [total, setTotal] = useState7(0);
  const [sortBy, setSortBy] = useState7("created_at");
  const [viewMode, setViewMode] = useState7("grid");
  const [selectedDoc, setSelectedDoc] = useState7(null);
  const [showTagsPanel, setShowTagsPanel] = useState7(false);
  const [tagSearchQuery, setTagSearchQuery] = useState7("");
  const [showMobileFilters, setShowMobileFilters] = useState7(false);
  const [starringDocId, setStarringDocId] = useState7(null);
  const loadDocs = useCallback6(async (resetPage = false) => {
    setLoading(true);
    try {
      const params = {
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
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedTags, currentPage, sortBy]);
  const loadTags = useCallback6(async () => {
    try {
      const tags = await tagService.getPopularTags(50);
      setAvailableTags(tags);
    } catch (error) {
      console.error("Failed to load tags:", error);
    }
  }, []);
  useEffect6(() => {
    loadDocs(true);
  }, [searchQuery, selectedTags, sortBy]);
  useEffect6(() => {
    loadTags();
  }, []);
  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };
  const toggleTag = (tagName) => {
    setSelectedTags((prev) => {
      const isSelected = prev.includes(tagName);
      if (isSelected) {
        return prev.filter((t) => t !== tagName);
      } else {
        return [...prev, tagName];
      }
    });
    setCurrentPage(1);
  };
  const handleStar = async (docId) => {
    if (!user) {
      await signInWithGithub();
      return;
    }
    if (starringDocId === docId) return;
    setStarringDocId(docId);
    try {
      const result = await docService.toggleStar(docId, user.id);
      setDocs(
        (prevDocs) => prevDocs.map((doc) => {
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
      if (selectedDoc && selectedDoc.id === docId) {
        setSelectedDoc((prev) => prev ? {
          ...prev,
          is_starred: result.starred,
          stars: result.starCount
        } : null);
      }
    } catch (error) {
      console.error("Failed to toggle star:", error);
    } finally {
      setStarringDocId(null);
    }
  };
  const handleDownload = async (docId) => {
    try {
      const result = await docService.downloadDocument(docId, user?.id);
      const blob = new Blob([result.content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setDocs(
        (prevDocs) => prevDocs.map(
          (doc) => doc.id === docId ? { ...doc, downloads: doc.downloads + 1 } : doc
        )
      );
    } catch (error) {
      console.error("Failed to download document:", error);
    }
  };
  const filteredTags = availableTags.filter(
    (tag) => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())
  );
  if (showProfile && user) {
    return /* @__PURE__ */ jsx3(
      UserProfile,
      {
        username: user.username,
        onEdit,
        onBack: () => setShowProfile(false)
      }
    );
  }
  return /* @__PURE__ */ jsxs3("div", { className: "min-h-screen bg-gray-50", children: [
    /* @__PURE__ */ jsx3("div", { className: "bg-white shadow-sm border-b sticky top-0 z-40", children: /* @__PURE__ */ jsxs3("div", { className: "max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8", children: [
      /* @__PURE__ */ jsxs3("div", { className: "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4", children: [
        /* @__PURE__ */ jsxs3("div", { className: "flex items-center space-x-4", children: [
          /* @__PURE__ */ jsx3("h1", { className: "text-2xl lg:text-3xl font-bold text-gray-900", children: "CLAUDE.md Hub" }),
          user && /* @__PURE__ */ jsxs3(
            "button",
            {
              onClick: () => setShowProfile(true),
              className: "flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors",
              children: [
                user.avatar_url && /* @__PURE__ */ jsx3(
                  "img",
                  {
                    src: user.avatar_url,
                    alt: user.username,
                    className: "w-5 h-5 rounded-full"
                  }
                ),
                "@",
                user.username
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsx3("div", { className: "flex items-center gap-3", children: user ? /* @__PURE__ */ jsxs3(
          "button",
          {
            onClick: onCreateNew,
            className: "bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2",
            children: [
              /* @__PURE__ */ jsx3("span", { className: "text-lg", children: "+" }),
              "Create CLAUDE.md"
            ]
          }
        ) : /* @__PURE__ */ jsxs3(
          "button",
          {
            onClick: () => signInWithGithub(),
            className: "bg-gray-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center gap-2",
            children: [
              /* @__PURE__ */ jsx3("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: /* @__PURE__ */ jsx3("path", { d: "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" }) }),
              "Sign in with GitHub"
            ]
          }
        ) })
      ] }),
      /* @__PURE__ */ jsxs3("div", { className: "mt-4 flex flex-col lg:flex-row gap-4", children: [
        /* @__PURE__ */ jsx3("div", { className: "flex-1", children: /* @__PURE__ */ jsxs3("div", { className: "relative", children: [
          /* @__PURE__ */ jsx3(
            "input",
            {
              type: "text",
              placeholder: "Search CLAUDE.md documents...",
              value: searchQuery,
              onChange: (e) => handleSearch(e.target.value),
              className: "w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            }
          ),
          /* @__PURE__ */ jsx3(
            "svg",
            {
              className: "absolute left-3 top-2.5 h-5 w-5 text-gray-400",
              fill: "none",
              stroke: "currentColor",
              viewBox: "0 0 24 24",
              children: /* @__PURE__ */ jsx3("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" })
            }
          )
        ] }) }),
        /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxs3(
            "select",
            {
              value: sortBy,
              onChange: (e) => setSortBy(e.target.value),
              className: "px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm",
              children: [
                /* @__PURE__ */ jsx3("option", { value: "created_at", children: "Latest" }),
                /* @__PURE__ */ jsx3("option", { value: "stars", children: "Most Starred" }),
                /* @__PURE__ */ jsx3("option", { value: "views", children: "Most Viewed" }),
                /* @__PURE__ */ jsx3("option", { value: "downloads", children: "Most Downloaded" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs3("div", { className: "flex border border-gray-300 rounded-lg overflow-hidden", children: [
            /* @__PURE__ */ jsx3(
              "button",
              {
                onClick: () => setViewMode("grid"),
                className: `px-3 py-2 text-sm ${viewMode === "grid" ? "bg-blue-50 text-blue-600" : "bg-white text-gray-600"}`,
                children: "Grid"
              }
            ),
            /* @__PURE__ */ jsx3(
              "button",
              {
                onClick: () => setViewMode("list"),
                className: `px-3 py-2 text-sm border-l border-gray-300 ${viewMode === "list" ? "bg-blue-50 text-blue-600" : "bg-white text-gray-600"}`,
                children: "List"
              }
            )
          ] }),
          /* @__PURE__ */ jsx3(
            "button",
            {
              onClick: () => setShowMobileFilters(!showMobileFilters),
              className: "lg:hidden px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white",
              children: "Filters"
            }
          )
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx3("div", { className: "max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8", children: /* @__PURE__ */ jsxs3("div", { className: "flex flex-col lg:flex-row gap-6", children: [
      /* @__PURE__ */ jsx3("div", { className: `lg:w-64 ${showMobileFilters ? "block" : "hidden lg:block"}`, children: /* @__PURE__ */ jsxs3("div", { className: "bg-white rounded-lg shadow-sm border p-4 sticky top-24", children: [
        /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between mb-3", children: [
          /* @__PURE__ */ jsx3("h3", { className: "font-semibold text-gray-900", children: "Tags" }),
          /* @__PURE__ */ jsx3(
            "button",
            {
              onClick: () => setShowTagsPanel(!showTagsPanel),
              className: "lg:hidden text-gray-500",
              children: showTagsPanel ? "\u2212" : "+"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: `${showTagsPanel ? "block" : "hidden lg:block"}`, children: [
          /* @__PURE__ */ jsx3(
            "input",
            {
              type: "text",
              placeholder: "Search tags...",
              value: tagSearchQuery,
              onChange: (e) => setTagSearchQuery(e.target.value),
              className: "w-full px-3 py-1.5 text-sm border border-gray-300 rounded mb-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            }
          ),
          selectedTags.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "mb-3", children: [
            /* @__PURE__ */ jsx3("div", { className: "text-xs font-medium text-gray-500 mb-2", children: "Selected" }),
            /* @__PURE__ */ jsx3("div", { className: "flex flex-wrap gap-1", children: selectedTags.map((tag) => /* @__PURE__ */ jsxs3(
              "button",
              {
                onClick: () => toggleTag(tag),
                className: "bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs flex items-center gap-1 hover:bg-blue-200 transition-colors",
                children: [
                  tag,
                  /* @__PURE__ */ jsx3("span", { className: "text-blue-500", children: "\xD7" })
                ]
              },
              tag
            )) })
          ] }),
          /* @__PURE__ */ jsx3("div", { className: "space-y-1 max-h-64 overflow-y-auto", children: filteredTags.slice(0, 20).map((tag) => /* @__PURE__ */ jsxs3(
            "button",
            {
              onClick: () => toggleTag(tag.name),
              className: `w-full text-left px-2 py-1.5 rounded text-sm transition-colors flex items-center justify-between ${selectedTags.includes(tag.name) ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50"}`,
              children: [
                /* @__PURE__ */ jsx3("span", { children: tag.name }),
                /* @__PURE__ */ jsx3("span", { className: "text-xs text-gray-500", children: tag.doc_count })
              ]
            },
            tag.id
          )) })
        ] })
      ] }) }),
      /* @__PURE__ */ jsxs3("div", { className: "flex-1", children: [
        /* @__PURE__ */ jsx3("div", { className: "flex items-center justify-between mb-6", children: /* @__PURE__ */ jsx3("div", { className: "text-sm text-gray-600", children: loading ? "Loading..." : `${total} document${total !== 1 ? "s" : ""} found` }) }),
        loading ? /* @__PURE__ */ jsx3("div", { className: "flex items-center justify-center py-12", children: /* @__PURE__ */ jsx3("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) }) : docs.length === 0 ? /* @__PURE__ */ jsxs3("div", { className: "text-center py-12", children: [
          /* @__PURE__ */ jsx3("div", { className: "text-6xl mb-4", children: "\u{1F4C4}" }),
          /* @__PURE__ */ jsx3("h3", { className: "text-xl font-medium text-gray-900 mb-2", children: "No documents found" }),
          /* @__PURE__ */ jsx3("p", { className: "text-gray-600 mb-4", children: "Try adjusting your search or filters, or create the first document!" }),
          user && /* @__PURE__ */ jsx3(
            "button",
            {
              onClick: onCreateNew,
              className: "bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors",
              children: "Create CLAUDE.md"
            }
          )
        ] }) : /* @__PURE__ */ jsxs3(Fragment2, { children: [
          /* @__PURE__ */ jsx3("div", { className: `grid gap-6 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`, children: docs.map((doc) => /* @__PURE__ */ jsx3("div", { className: "bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow", children: /* @__PURE__ */ jsxs3("div", { className: "p-6", children: [
            /* @__PURE__ */ jsxs3("div", { className: "flex items-start justify-between mb-3", children: [
              /* @__PURE__ */ jsx3("h3", { className: "text-lg font-semibold text-gray-900 line-clamp-2", children: doc.title }),
              /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-1 ml-2", children: [
                /* @__PURE__ */ jsx3(
                  "button",
                  {
                    onClick: () => handleStar(doc.id),
                    disabled: starringDocId === doc.id,
                    className: `p-1.5 rounded transition-colors ${doc.is_starred ? "text-yellow-500 hover:text-yellow-600" : "text-gray-400 hover:text-yellow-500"} ${starringDocId === doc.id ? "opacity-50" : ""}`,
                    children: /* @__PURE__ */ jsx3("span", { className: "text-sm", children: "\u2605" })
                  }
                ),
                /* @__PURE__ */ jsx3(
                  "button",
                  {
                    onClick: () => handleDownload(doc.id),
                    className: "p-1.5 text-gray-400 hover:text-blue-500 rounded transition-colors",
                    children: /* @__PURE__ */ jsx3("span", { className: "text-sm", children: "\u2B07" })
                  }
                )
              ] })
            ] }),
            doc.description && /* @__PURE__ */ jsx3("p", { className: "text-gray-600 text-sm mb-3 line-clamp-2", children: doc.description }),
            doc.tag_names.length > 0 && /* @__PURE__ */ jsxs3("div", { className: "flex flex-wrap gap-1 mb-3", children: [
              doc.tag_names.slice(0, 4).map((tag) => /* @__PURE__ */ jsx3(
                "span",
                {
                  className: "bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs",
                  children: tag
                },
                tag
              )),
              doc.tag_names.length > 4 && /* @__PURE__ */ jsxs3("span", { className: "text-gray-500 text-xs px-1", children: [
                "+",
                doc.tag_names.length - 4
              ] })
            ] }),
            /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-between text-xs text-gray-500", children: [
              /* @__PURE__ */ jsxs3("span", { children: [
                "by @",
                doc.author_username
              ] }),
              /* @__PURE__ */ jsxs3("div", { className: "flex items-center gap-3", children: [
                /* @__PURE__ */ jsxs3("span", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ jsx3("span", { children: "\u2605" }),
                  " ",
                  doc.stars
                ] }),
                /* @__PURE__ */ jsxs3("span", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ jsx3("span", { children: "\u{1F441}" }),
                  " ",
                  doc.views
                ] }),
                /* @__PURE__ */ jsxs3("span", { className: "flex items-center gap-1", children: [
                  /* @__PURE__ */ jsx3("span", { children: "\u2B07" }),
                  " ",
                  doc.downloads
                ] })
              ] })
            ] })
          ] }) }, doc.id)) }),
          totalPages > 1 && /* @__PURE__ */ jsxs3("div", { className: "flex items-center justify-center mt-8 gap-2", children: [
            /* @__PURE__ */ jsx3(
              "button",
              {
                onClick: () => setCurrentPage((prev) => Math.max(1, prev - 1)),
                disabled: currentPage === 1,
                className: "px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors",
                children: "Previous"
              }
            ),
            /* @__PURE__ */ jsxs3("span", { className: "px-4 py-2 text-sm text-gray-600", children: [
              "Page ",
              currentPage,
              " of ",
              totalPages
            ] }),
            /* @__PURE__ */ jsx3(
              "button",
              {
                onClick: () => setCurrentPage((prev) => Math.min(totalPages, prev + 1)),
                disabled: currentPage === totalPages,
                className: "px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors",
                children: "Next"
              }
            )
          ] })
        ] })
      ] })
    ] }) })
  ] });
};

// components/ClaudeDocEditor.tsx
import { useState as useState8, useEffect as useEffect7 } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
var ClaudeDocEditor = ({
  docId,
  onSave,
  onCancel
}) => {
  const { user } = useAuth2();
  const docService = new ClaudeDocService();
  const tagService = new TagService();
  const [loading, setLoading] = useState8(false);
  const [saving, setSaving] = useState8(false);
  const [error, setError] = useState8(null);
  const [title, setTitle] = useState8("");
  const [description, setDescription] = useState8("");
  const [content, setContent] = useState8("");
  const [tagInput, setTagInput] = useState8("");
  const [selectedTags, setSelectedTags] = useState8([]);
  const [isPublic, setIsPublic] = useState8(true);
  const [tagSuggestions, setTagSuggestions] = useState8([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState8(false);
  useEffect7(() => {
    if (docId && user) {
      loadDocument();
    }
  }, [docId, user]);
  useEffect7(() => {
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
      const doc = await docService.getDocument(docId, user.id, false);
      if (!doc) {
        setError("Document not found or access denied");
        return;
      }
      setTitle(doc.title);
      setDescription(doc.description || "");
      setContent(doc.content);
      setSelectedTags(doc.tag_names);
      setIsPublic(doc.is_public);
    } catch (error2) {
      console.error("Failed to load document:", error2);
      setError("Failed to load document");
    } finally {
      setLoading(false);
    }
  };
  const loadTagSuggestions = async () => {
    try {
      const suggestions = await tagService.getTagSuggestions(tagInput);
      setTagSuggestions(suggestions);
      setShowTagSuggestions(true);
    } catch (error2) {
      console.error("Failed to load tag suggestions:", error2);
    }
  };
  const handleAddTag = (tagName) => {
    const normalizedTag = tagName.trim().toLowerCase();
    if (normalizedTag && !selectedTags.includes(normalizedTag) && selectedTags.length < 10) {
      setSelectedTags((prev) => [...prev, normalizedTag]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };
  const handleRemoveTag = (tagName) => {
    setSelectedTags((prev) => prev.filter((tag) => tag !== tagName));
  };
  const handleTagInputKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (tagInput.trim()) {
        handleAddTag(tagInput);
      }
    } else if (e.key === "Escape") {
      setShowTagSuggestions(false);
    }
  };
  const validateForm = () => {
    if (!title.trim()) {
      return "Title is required";
    }
    if (title.length > 200) {
      return "Title must be 200 characters or less";
    }
    if (!content.trim()) {
      return "Content is required";
    }
    if (content.length > 1e6) {
      return "Content is too large (max 1MB)";
    }
    if (description.length > 500) {
      return "Description must be 500 characters or less";
    }
    return null;
  };
  const handleSave = async () => {
    if (!user) {
      setError("You must be logged in to save documents");
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
      let savedDoc;
      if (docId) {
        savedDoc = await docService.updateDocument(docId, docData, user.id);
      } else {
        savedDoc = await docService.createDocument(docData, user.id);
      }
      onSave?.(savedDoc);
    } catch (error2) {
      console.error("Failed to save document:", error2);
      setError(error2 instanceof Error ? error2.message : "Failed to save document");
    } finally {
      setSaving(false);
    }
  };
  const getRecommendedTags = () => {
    return tagService.getRecommendedTags(title, description, content).filter((tag) => !selectedTags.includes(tag)).slice(0, 5);
  };
  if (loading) {
    return /* @__PURE__ */ jsx4("div", { className: "min-h-screen bg-gray-50 flex items-center justify-center", children: /* @__PURE__ */ jsx4("div", { className: "animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" }) });
  }
  return /* @__PURE__ */ jsx4("div", { className: "min-h-screen bg-gray-50", children: /* @__PURE__ */ jsxs4("div", { className: "max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8", children: [
    /* @__PURE__ */ jsxs4("div", { className: "mb-8", children: [
      /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between mb-4", children: [
        /* @__PURE__ */ jsx4("h1", { className: "text-2xl lg:text-3xl font-bold text-gray-900", children: docId ? "Edit Document" : "Create CLAUDE.md" }),
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: onCancel,
            className: "text-gray-500 hover:text-gray-700 transition-colors",
            children: "\u2715"
          }
        )
      ] }),
      error && /* @__PURE__ */ jsx4("div", { className: "bg-red-50 border border-red-200 rounded-lg p-3 mb-4", children: /* @__PURE__ */ jsx4("p", { className: "text-sm text-red-700", children: error }) })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "bg-white rounded-lg shadow-sm border", children: [
      /* @__PURE__ */ jsxs4("div", { className: "p-6 space-y-6", children: [
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("label", { htmlFor: "title", className: "block text-sm font-medium text-gray-700 mb-2", children: "Title *" }),
          /* @__PURE__ */ jsx4(
            "input",
            {
              id: "title",
              type: "text",
              value: title,
              onChange: (e) => setTitle(e.target.value),
              placeholder: "Enter document title...",
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              maxLength: 200
            }
          ),
          /* @__PURE__ */ jsxs4("p", { className: "text-xs text-gray-500 mt-1", children: [
            title.length,
            "/200 characters"
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("label", { htmlFor: "description", className: "block text-sm font-medium text-gray-700 mb-2", children: "Description" }),
          /* @__PURE__ */ jsx4(
            "textarea",
            {
              id: "description",
              value: description,
              onChange: (e) => setDescription(e.target.value),
              placeholder: "Brief description of the document...",
              rows: 3,
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none",
              maxLength: 500
            }
          ),
          /* @__PURE__ */ jsxs4("p", { className: "text-xs text-gray-500 mt-1", children: [
            description.length,
            "/500 characters"
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("label", { htmlFor: "tags", className: "block text-sm font-medium text-gray-700 mb-2", children: "Tags" }),
          selectedTags.length > 0 && /* @__PURE__ */ jsx4("div", { className: "flex flex-wrap gap-2 mb-3", children: selectedTags.map((tag) => /* @__PURE__ */ jsxs4(
            "span",
            {
              className: "bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1",
              children: [
                tag,
                /* @__PURE__ */ jsx4(
                  "button",
                  {
                    onClick: () => handleRemoveTag(tag),
                    className: "text-blue-500 hover:text-blue-700",
                    children: "\xD7"
                  }
                )
              ]
            },
            tag
          )) }),
          /* @__PURE__ */ jsxs4("div", { className: "relative", children: [
            /* @__PURE__ */ jsx4(
              "input",
              {
                id: "tags",
                type: "text",
                value: tagInput,
                onChange: (e) => setTagInput(e.target.value),
                onKeyDown: handleTagInputKeyDown,
                placeholder: "Type to add tags...",
                className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              }
            ),
            showTagSuggestions && tagSuggestions.length > 0 && /* @__PURE__ */ jsx4("div", { className: "absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg", children: tagSuggestions.map((tag) => /* @__PURE__ */ jsx4(
              "button",
              {
                onClick: () => handleAddTag(tag),
                className: "w-full text-left px-3 py-2 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg",
                children: tag
              },
              tag
            )) })
          ] }),
          (title || description || content) && /* @__PURE__ */ jsxs4("div", { className: "mt-2", children: [
            /* @__PURE__ */ jsx4("p", { className: "text-xs text-gray-500 mb-1", children: "Recommended:" }),
            /* @__PURE__ */ jsx4("div", { className: "flex flex-wrap gap-1", children: getRecommendedTags().map((tag) => /* @__PURE__ */ jsxs4(
              "button",
              {
                onClick: () => handleAddTag(tag),
                className: "bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs hover:bg-gray-200 transition-colors",
                children: [
                  "+ ",
                  tag
                ]
              },
              tag
            )) })
          ] }),
          /* @__PURE__ */ jsxs4("p", { className: "text-xs text-gray-500 mt-1", children: [
            selectedTags.length,
            "/10 tags \u2022 Press Enter to add"
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("label", { htmlFor: "content", className: "block text-sm font-medium text-gray-700 mb-2", children: "Content * (Markdown)" }),
          /* @__PURE__ */ jsx4(
            "textarea",
            {
              id: "content",
              value: content,
              onChange: (e) => setContent(e.target.value),
              placeholder: "# CLAUDE.md\n\nThis file provides guidance to Claude Code when working with your project.\n\n## Setup\n\nDescribe how to set up and use your project...\n\n## Examples\n\nProvide examples and usage instructions...",
              rows: 20,
              className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-none"
            }
          ),
          /* @__PURE__ */ jsxs4("p", { className: "text-xs text-gray-500 mt-1", children: [
            (content.length / 1e3).toFixed(1),
            "KB / 1000KB"
          ] })
        ] }),
        /* @__PURE__ */ jsxs4("div", { children: [
          /* @__PURE__ */ jsx4("label", { className: "block text-sm font-medium text-gray-700 mb-2", children: "Visibility" }),
          /* @__PURE__ */ jsxs4("div", { className: "space-y-2", children: [
            /* @__PURE__ */ jsxs4("label", { className: "flex items-center", children: [
              /* @__PURE__ */ jsx4(
                "input",
                {
                  type: "radio",
                  name: "visibility",
                  checked: isPublic,
                  onChange: () => setIsPublic(true),
                  className: "mr-2"
                }
              ),
              /* @__PURE__ */ jsx4("span", { className: "text-sm", children: "Public - Anyone can view and download" })
            ] }),
            /* @__PURE__ */ jsxs4("label", { className: "flex items-center", children: [
              /* @__PURE__ */ jsx4(
                "input",
                {
                  type: "radio",
                  name: "visibility",
                  checked: !isPublic,
                  onChange: () => setIsPublic(false),
                  className: "mr-2"
                }
              ),
              /* @__PURE__ */ jsx4("span", { className: "text-sm", children: "Private - Only you can view" })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx4("div", { className: "border-t bg-gray-50 px-6 py-4 rounded-b-lg", children: /* @__PURE__ */ jsxs4("div", { className: "flex items-center justify-between", children: [
        /* @__PURE__ */ jsx4(
          "button",
          {
            onClick: onCancel,
            className: "px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors",
            children: "Cancel"
          }
        ),
        /* @__PURE__ */ jsxs4(
          "button",
          {
            onClick: handleSave,
            disabled: saving || !title.trim() || !content.trim(),
            className: "px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2",
            children: [
              saving && /* @__PURE__ */ jsx4("div", { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white" }),
              saving ? "Saving..." : docId ? "Update" : "Create"
            ]
          }
        )
      ] }) })
    ] })
  ] }) });
};

// components/ClaudeDocApp.tsx
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var ClaudeDocApp = () => {
  const [currentView, setCurrentView] = useState9("browser");
  const [editingDocId, setEditingDocId] = useState9(null);
  const handleCreateNew = () => {
    setEditingDocId(null);
    setCurrentView("create");
  };
  const handleEdit = (docId) => {
    setEditingDocId(docId);
    setCurrentView("edit");
  };
  const handleSave = (doc) => {
    console.log("Document saved:", doc);
    setCurrentView("browser");
    setEditingDocId(null);
  };
  const handleCancel = () => {
    setCurrentView("browser");
    setEditingDocId(null);
  };
  return /* @__PURE__ */ jsx5(AuthProvider, { children: /* @__PURE__ */ jsxs5("div", { className: "min-h-screen bg-gray-50", children: [
    currentView === "browser" && /* @__PURE__ */ jsx5(
      ClaudeDocBrowser,
      {
        onCreateNew: handleCreateNew,
        onEdit: handleEdit
      }
    ),
    (currentView === "create" || currentView === "edit") && /* @__PURE__ */ jsx5(
      ClaudeDocEditor,
      {
        docId: editingDocId || void 0,
        onSave: handleSave,
        onCancel: handleCancel
      }
    )
  ] }) });
};
export {
  AuthProvider,
  AuthService,
  AuthStatus,
  ClaudeDocApp,
  ClaudeDocBrowser,
  ClaudeDocEditor,
  ClaudeDocRepository,
  ClaudeDocService,
  RequireAuth,
  SearchService,
  StarRepository,
  TagRepository,
  TagService,
  UserProfile,
  UserRepository,
  ClaudeDocApp as default,
  getCurrentSession,
  getCurrentUser,
  supabase,
  useAuth2 as useAuth,
  useClaudeDocs,
  useDocumentListRealtime,
  useDocumentRealtime,
  useIsAuthenticated,
  useIsOwner,
  useRealtime,
  useSearch,
  useStarRealtime,
  useTags,
  useUserId,
  useUsername
};
