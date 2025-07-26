# Des Moines Insider - Event Discovery Platform

## Overview

Des Moines Insider is a full-stack web application that provides AI-enhanced event discovery for Des Moines, Iowa. The platform scrapes event data from multiple sources, enhances descriptions using OpenAI, and provides a comprehensive guide to events, restaurants, attractions, and playgrounds in the Des Moines area.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **API Pattern**: RESTful API with Express routes
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **External Services**: OpenAI API for content enhancement, Puppeteer for web scraping

### Monorepo Structure
The application follows a monorepo pattern with three main directories:
- `client/` - React frontend application
- `server/` - Express.js backend API
- `shared/` - Common TypeScript types and database schema

## Key Components

### Data Models
- **Events**: Core entity with AI-enhanced descriptions, scraped from multiple sources
- **Restaurants**: Local dining establishments with ratings and search tracking
- **Restaurant Openings**: New restaurant tracking from local news sources
- **Attractions**: Tourist destinations and points of interest
- **Playgrounds**: Family-friendly locations with age-appropriate features
- **Users**: User accounts for personalization (schema defined but not fully implemented)
- **Newsletter**: Email subscription management

### Enhanced Event Pipeline
1. **Comprehensive Scraping**: Automated data collection from multiple sources:
   - Google Events (with direct website linking)
   - Catch Des Moines (enhanced to extract direct event URLs)
   - Eventbrite
   - Music venues: Vibrant Music Hall, Hoyt Sherman Place, Val Aire Ballroom
   - Sports teams: Iowa Wild, Iowa Wolves, Iowa Cubs, Iowa Barnstormers
   - Iowa Events Center
2. **Event Deduplication**: Prevents duplicate events across multiple sources
3. **AI Enhancement**: OpenAI integration to improve event descriptions and add context
4. **Direct Website Linking**: Links directly to event websites instead of intermediary pages
5. **Categorization**: Automatic classification of events by type and venue
6. **Storage**: Persistent storage with original and enhanced content

### Restaurant Tracking Pipeline
1. **News Source Monitoring**: Automated scraping from local news sources:
   - DSM Magazine restaurant opening articles
   - Des Moines Register dining news
2. **Restaurant Data Extraction**: Parsing of restaurant names, cuisine types, opening dates
3. **Status Tracking**: Classification as "opening_soon", "newly_opened", or "announced"
4. **Source Attribution**: Links back to original news articles

### Search and Discovery Features
- **Event Filtering**: By category, date, and location across all sources
- **Featured Events**: AI-curated selection of noteworthy events
- **Most Searched**: Tracking popular restaurants, attractions, and playgrounds
- **Restaurant Openings**: Latest restaurant news and opening announcements
- **Direct Event Links**: Links directly to event websites instead of intermediary pages
- **Event Deduplication**: Prevents duplicate events from multiple sources
- **Newsletter Subscription**: Email updates for new events and recommendations

## Data Flow

1. **Event Ingestion**: Cron job triggers scraping from external sources
2. **Content Enhancement**: Raw event data processed through OpenAI API
3. **Database Storage**: Enhanced events stored with metadata and categorization
4. **API Serving**: REST endpoints provide filtered and formatted data to frontend
5. **User Interaction**: React components fetch and display data using React Query
6. **Search Tracking**: User interactions increment popularity counters

## External Dependencies

### Required Services
- **OpenAI API**: For event description enhancement (GPT-4o model)
- **PostgreSQL Database**: Persistent data storage (configured for Neon)
- **Web Scraping Targets**: Google Events, Catch Des Moines website

### Development Tools
- **Puppeteer**: Headless browser automation for web scraping
- **Drizzle Kit**: Database schema management and migrations
- **Tailwind CSS**: Utility-first styling framework
- **TypeScript**: Type safety across the entire stack

### UI Dependencies
- **Radix UI**: Unstyled, accessible component primitives
- **Lucide React**: Icon library
- **date-fns**: Date manipulation and formatting
- **React Hook Form**: Form state management with validation

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React app to `dist/public/`
- **Backend**: esbuild bundles server code to `dist/index.js`
- **Database**: Drizzle migrations handle schema updates

### Environment Configuration
- **Development**: Local development with hot reloading via Vite
- **Production**: Node.js server serves both API and static frontend files
- **Database**: PostgreSQL connection via `DATABASE_URL` environment variable
- **API Keys**: OpenAI API key required for content enhancement features

### Scaling Considerations
- **Database**: Uses connection pooling via Neon serverless PostgreSQL
- **Caching**: React Query provides client-side caching for API responses
- **Error Handling**: Comprehensive error boundaries and API error responses
- **Monitoring**: Request logging and performance tracking built into Express middleware

The application is designed to be deployed on platforms like Replit, Vercel, or similar Node.js hosting services with minimal configuration requirements.