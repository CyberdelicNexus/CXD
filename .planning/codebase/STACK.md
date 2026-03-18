# Technology Stack

**Analysis Date:** 2026-03-18

## Languages

**Primary:**
- TypeScript 5.x - Full codebase type-safe implementation with strict mode enabled
- JavaScript - Configuration files (`next.config.js`)
- SQL - Database migrations and stored procedures in `supabase/migrations/`

**Secondary:**
- JSX/TSX - React component syntax
- Markdown - Document and email templates

## Runtime

**Environment:**
- Node.js (version unspecified in repo, inferred from Next.js 14.2.x compatibility)

**Package Manager:**
- npm - Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Next.js 14.2.23 - Full-stack React framework with App Router
- React 18 - UI library with hooks and server components
- TypeScript 5 - Type safety and tooling

**UI Components & Styling:**
- Radix UI 1.1.3 - Comprehensive headless component library (accordion, dialog, popover, tabs, etc.)
- TailwindCSS 3 - Utility-first CSS framework
- Tailwind Merge 2 - Resolve TailwindCSS class conflicts
- Tailwindcss Animate 1 - Animation utilities
- Class Variance Authority 0.7.1 - Component variant management
- Framer Motion 12.5.0 - Advanced animations and gestures
- Lucide React 0.468.0 - Icon library (over 400 icons)
- Embla Carousel React 8.6.0 - Carousel component

**State Management:**
- Zustand 5.0.9 - Lightweight state management (`src/store/cxd-store.ts`)
- Yjs 13.6.29 - CRDT for real-time collaboration
- Y-IndexedDB 9.0.12 - Browser storage for Yjs
- Y-Protocols 1.0.7 - Protocol utilities for Yjs

**Forms & Validation:**
- React Hook Form 7.68.0 - Form state management
- @hookform/resolvers 5.2.2 - Schema validation adapters
- Zod 4.2.1 - TypeScript-first schema validation

**Rich Text Editing:**
- TipTap 3.19.0 - Headless rich text editor with extensions
- TipTap React 3.19.0 - React bindings for TipTap
- TipTap Starter Kit 3.19.0 - Core extensions
- React Markdown 10.1.0 - Markdown rendering
- Marked 17.0.2 - Markdown parser
- Remark GFM 4.0.1 - GitHub Flavored Markdown support

**AI/ML:**
- Vercel AI SDK 6.0.78 - Streaming AI responses across multiple providers
- @ai-sdk/openai 3.0.26 - OpenAI integration
- @ai-sdk/anthropic 3.0.41 - Anthropic Claude integration
- @ai-sdk/google 3.0.23 - Google Generative AI integration
- @ai-sdk/react 3.0.80 - React hooks for AI SDK

**Document Export:**
- jsPDF 4.1.0 - PDF generation
- html2canvas 1.4.1 - HTML to canvas conversion
- docx 9.5.1 - DOCX document generation
- file-saver 2.0.5 - Browser file download

**Email:**
- Resend 6.9.1 - Transactional email service
- React Email 5.2.8 - Email component templates
- @react-email/components 1.0.8 - Email UI components
- @react-email/render 2.0.4 - HTML rendering for emails

**Payment & Billing:**
- Stripe 17.6.0 - Payment processing SDK

**Date & Time:**
- Date-fns 4.1.0 - Date manipulation and formatting
- React Day Picker 9.12.0 - Date picker component

**Utilities:**
- UUID 13.0.0 - UUID generation
- @types/uuid 10.0.0 - TypeScript definitions
- CLSX 2.1.1 - Conditional classname utility
- CMDk 1.1.1 - Command menu component

**UI/UX:**
- Next Themes 0.2.1 - Theme management (dark/light mode)
- Sonner 2.0.7 - Toast notifications
- Vaul 1.1.2 - Drawer component
- React Resizable Panels 2.1.9 - Resizable panel layouts

**Charts & Visualization:**
- Recharts 2.15.4 - React charting library

**Development & Formatting:**
- Prettier 3.3.3 - Code formatter
- Autoprefixer 10.4.20 - PostCSS plugin for vendor prefixes
- PostCSS 8 - CSS transformation tool

**Monitoring:**
- Tempo DevTools 2.0.94 - Development time-travel debugging

**Type Definitions:**
- @types/node 20 - Node.js type definitions
- @types/react 18 - React type definitions
- @types/react-dom 18 - React DOM type definitions
- @types/file-saver 2.0.7 - File Saver type definitions

## Configuration

**Environment:**
- Environment variables in `.env.example` and `.env.local`
- Configuration schema defined in `.env.example`
- Next.js builds support both development and production environments

**Build:**
- `next.config.js` - Next.js configuration with:
  - Remote image patterns for Unsplash and Supabase storage
  - WebP and AVIF image formats
  - Webpack alias resolution for Yjs to prevent duplicate imports
  - Package import optimization for lucide-react, framer-motion, recharts

**TypeScript:**
- `tsconfig.json` with strict mode enabled
- Path aliases: `@/*` → `./src/*` and `@emails/*` → `./emails/*`
- Target: ES5
- Excluded: `node_modules` and `supabase/functions`

**PostCSS & Tailwind:**
- `postcss.config.js` (inferred from dependencies) - CSS processing pipeline

## Platform Requirements

**Development:**
- Node.js (compatible with Next.js 14.2.x)
- npm (package manager)
- Modern browser with ES2020+ support

**Production:**
- Vercel (primary deployment target - inferred from Next.js deployment context)
- Next.js deployment compatible hosting
- Environment variables configured for production (`.env.local` provides real values)
- Supports edge functions for API routes

---

*Stack analysis: 2026-03-18*
