'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Sparkles, 
  Wand2, 
  Layout, 
  Target,
  Brain,
  Layers,
  ArrowRight,
  LogIn
} from 'lucide-react';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-border flex items-center justify-center glow-teal">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-semibold text-gradient">CXD Canvas</span>
          </div>
          <a href="/sign-in">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
              <LogIn className="w-4 h-4 mr-2" />
              Log In
            </Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-border mb-8 glow-purple">
            <Sparkles className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            <span className="text-gradient">Cyberdelic Experience</span>
            <br />
            <span className="text-foreground">Design Canvas</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Design transformational experiences that reliably produce 
            <span className="text-primary font-medium"> specific states </span> 
            and integrate them into 
            <span className="text-accent font-medium"> lasting traits</span>.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/sign-up">
              <Button size="lg" className="glow-teal text-lg px-8 py-6">
                <Sparkles className="w-5 h-5 mr-2" />
                Start Your First Map
              </Button>
            </a>
            <a href="/sign-in">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-border hover:bg-secondary/50">
                <LogIn className="w-5 h-5 mr-2" />
                Log In
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* What This Tool Does Section */}
      <section className="py-20 px-4 bg-gradient-radial">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient">What This Tool Does</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A coherent digital system for designing immersive, transformational experiences.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="gradient-border bg-card/50 backdrop-blur hover:bg-card/70 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Design with Intention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Begin with your core message and intention. Let the system guide you through translating vision into structured experience design.
                </p>
              </CardContent>
            </Card>

            <Card className="gradient-border bg-card/50 backdrop-blur hover:bg-card/70 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-3">
                  <Brain className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="text-xl">Map States to Traits</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Bridge temporary experiences with lasting transformation. Design how momentary states become enduring traits through integration.
                </p>
              </CardContent>
            </Card>

            <Card className="gradient-border bg-card/50 backdrop-blur hover:bg-card/70 transition-colors">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
                  <Layers className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Structure Complexity</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Hold complex experiential variables simultaneously. Visualize reality planes, sensory domains, presence types, and experience flow.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient">How It Works</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Three steps from intention to fully realized experience design.
            </p>
          </div>
          
          <div className="space-y-8">
            <div className="flex items-start gap-6 group">
              <div className="flex-shrink-0 w-14 h-14 rounded-full gradient-border flex items-center justify-center text-xl font-bold text-primary glow-teal group-hover:scale-110 transition-transform">
                1
              </div>
              <div className="flex-1 pt-2">
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-primary" />
                  Define Your Intention
                </h3>
                <p className="text-muted-foreground text-lg">
                  Answer guided questions through our Initiation Wizard to establish your core message, audience, and transformational goals.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-6 group">
              <div className="flex-shrink-0 w-14 h-14 rounded-full gradient-border flex items-center justify-center text-xl font-bold text-accent glow-purple group-hover:scale-110 transition-transform">
                2
              </div>
              <div className="flex-1 pt-2">
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Layout className="w-5 h-5 text-accent" />
                  Design on the Canvas
                </h3>
                <p className="text-muted-foreground text-lg">
                  Use the infinite spatial canvas to map reality planes, sensory domains, presence types, and build your complete experience flow timeline.
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-6 group">
              <div className="flex-shrink-0 w-14 h-14 rounded-full gradient-border flex items-center justify-center text-xl font-bold text-primary glow-teal group-hover:scale-110 transition-transform">
                3
              </div>
              <div className="flex-1 pt-2">
                <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Review and Refine
                </h3>
                <p className="text-muted-foreground text-lg">
                  Iterate using focus mode for deep work. Validate state-to-trait alignment. Share live views with collaborators for feedback.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-gradient-radial">
        <div className="container mx-auto max-w-3xl text-center">
          <div className="gradient-border bg-card/50 backdrop-blur rounded-2xl p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              <span className="text-gradient">Ready to Design?</span>
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Begin designing your first transformational experience map. 
              Turn states into lasting traits.
            </p>
            <a href="/sign-up">
              <Button size="lg" className="glow-teal text-lg px-10 py-6">
                <Sparkles className="w-5 h-5 mr-2" />
                Start Your First Map
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg gradient-border flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">CXD Canvas</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Design experiences that transform.
          </p>
        </div>
      </footer>
    </div>
  );
}
