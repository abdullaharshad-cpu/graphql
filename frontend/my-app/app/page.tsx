"use client";

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
};

type Comment = {
  id: number;
  comment: string;
  createdAt: string;
  user: User;
};

type Post = {
  id: number;
  title: string;
  createdAt: string;
  author: User;
  comments: Comment[];
};

const API_URL = "http://localhost:4000/graphql";

async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors[0].message);
  }

  return payload.data as T;
}

export default function Home() {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [me, setMe] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [postTitle, setPostTitle] = useState("");
  const [commentText, setCommentText] = useState("");
  const [status, setStatus] = useState("Ready to connect to the backend.");

  const loadPosts = async () => {
    const data = await graphqlRequest<{ posts: Post[] }>(`
      query {
        posts {
          id
          title
          createdAt
          author { id name email }
          comments {
            id
            comment
            createdAt
            user { id name }
          }
        }
      }
    `);
    setPosts(data.posts);
    if (!selectedPostId && data.posts[0]) {
      setSelectedPostId(data.posts[0].id);
    }
  };

  const loadMe = async () => {
    try {
      const data = await graphqlRequest<{ me: User | null }>(`
        query {
          me {
            id
            name
            email
            createdAt
          }
        }
      `);
      setMe(data.me);
    } catch {
      setMe(null);
    }
  };

  useEffect(() => {
    void loadMe();
    void loadPosts();
  }, []);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("Authenticating...");

    const mutation = mode === "signup"
      ? `mutation Signup($name: String!, $email: String!, $password: String!) {
          signup(name: $name, email: $email, password: $password) {
            success
            message
            user { id name email createdAt }
          }
        }`
      : `mutation Login($email: String!, $password: String!) {
          login(email: $email, password: $password) {
            success
            message
            user { id name email createdAt }
          }
        }`;

    const variables = mode === "signup"
      ? { name: authForm.name, email: authForm.email, password: authForm.password }
      : { email: authForm.email, password: authForm.password };

    const data = await graphqlRequest<{ signup?: { success: boolean; message: string }; login?: { success: boolean; message: string } }>(mutation, variables);
    const result = data.signup ?? data.login;
    setStatus(result?.message ?? "Auth flow completed.");
    if (result?.success) {
      setAuthForm({ name: "", email: "", password: "" });
      await loadMe();
      await loadPosts();
    }
  };

  const handleCreatePost = async (event: FormEvent) => {
    event.preventDefault();
    const data = await graphqlRequest<{ createPost: Post }>(`mutation CreatePost($title: String!) {
      createPost(title: $title) {
        id
        title
        createdAt
        author { id name }
        comments { id comment createdAt user { id name } }
      }
    }`, { title: postTitle });
    setPosts((current) => [data.createPost, ...current]);
    setPostTitle("");
    setStatus("Post created successfully.");
  };

  const handleCreateComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedPostId) {
      setStatus("Choose a post before commenting.");
      return;
    }

    const data = await graphqlRequest<{ createComment: Comment }>(`mutation CreateComment($postId: Int!, $comment: String!) {
      createComment(postId: $postId, comment: $comment) {
        id
        comment
        createdAt
        user { id name }
        post { id title }
      }
    }`, { postId: selectedPostId, comment: commentText });

    setPosts((current) =>
      current.map((post) =>
        post.id === selectedPostId
          ? { ...post, comments: [...post.comments, data.createComment] }
          : post
      )
    );
    setCommentText("");
    setStatus("Comment added.");
  };

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400">GraphQL Demo</p>
          <h1 className="mt-2 text-3xl font-semibold">Posts, comments, and session-aware GraphQL flows</h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Create an account or log in, then publish posts and add comments with the backend session cookie.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Authentication</h2>
              <span className="text-sm text-zinc-400">{me ? `Signed in as ${me.name}` : "Not signed in"}</span>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className={`rounded-full px-4 py-2 text-sm ${mode === "signup" ? "bg-cyan-500 text-black" : "bg-zinc-800"}`}
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
              <button
                className={`rounded-full px-4 py-2 text-sm ${mode === "login" ? "bg-cyan-500 text-black" : "bg-zinc-800"}`}
                onClick={() => setMode("login")}
              >
                Log in
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleAuth}>
              {mode === "signup" && (
                <input
                  value={authForm.name}
                  onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
                  placeholder="Your name"
                />
              )}
              <input
                value={authForm.email}
                onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="Email"
              />
              <input
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
                type="password"
                placeholder="Password"
              />
              <button className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black" type="submit">
                {mode === "signup" ? "Create account" : "Log in"}
              </button>
            </form>

            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-400">
              {status}
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="text-xl font-semibold">Create a post</h2>
            <form className="mt-4 space-y-3" onSubmit={handleCreatePost}>
              <input
                value={postTitle}
                onChange={(event) => setPostTitle(event.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2"
                placeholder="Post title"
              />
              <button className="rounded-xl bg-emerald-500 px-4 py-2 font-medium text-black" type="submit">
                Publish post
              </button>
            </form>
          </section>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Feed</h2>
            <span className="text-sm text-zinc-400">{posts.length} posts</span>
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-3">
              {posts.map((post) => (
                <button
                  key={post.id}
                  className={`w-full rounded-xl border p-4 text-left ${selectedPostId === post.id ? "border-cyan-500 bg-zinc-800" : "border-zinc-800 bg-zinc-950"}`}
                  onClick={() => setSelectedPostId(post.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{post.title}</h3>
                    <span className="text-xs text-zinc-500">{post.comments.length} comments</span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">By {post.author.name}</p>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              {selectedPostId ? (
                <>
                  <h3 className="text-lg font-semibold">{posts.find((post) => post.id === selectedPostId)?.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400">
                    {posts.find((post) => post.id === selectedPostId)?.comments.length ?? 0} comments loaded for this post.
                  </p>

                  <form className="mt-4 space-y-3" onSubmit={handleCreateComment}>
                    <textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      className="min-h-24 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2"
                      placeholder="Write a comment"
                    />
                    <button className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black" type="submit">
                      Add comment
                    </button>
                  </form>

                  <div className="mt-4 space-y-3">
                    {(posts.find((post) => post.id === selectedPostId)?.comments ?? []).map((comment) => (
                      <div key={comment.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                        <p className="text-sm">{comment.comment}</p>
                        <p className="mt-2 text-xs text-zinc-500">By {comment.user.name}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-sm text-zinc-400">Choose a post to view its comments.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
