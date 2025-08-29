
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Plus, Search, Archive } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { MeetingPreparation } from "@/components/MeetingPreparation";

interface Meeting {
  id: string;
  title: string;
  created_at: string;
  created_by: string;
}

const Meetings = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const { data, error } = await supabase
          .from("meetings")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;
        setMeetings(data || []);
      } catch (error: any) {
        console.error("Erreur lors du chargement des réunions:", error);
        toast({
          title: "Erreur de chargement des réunions",
          description: error.message || "Veuillez réessayer plus tard",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMeetings();
  }, [toast]);

  const handleCreateMeeting = () => {
    navigate("/meetings/new");
  };

  const handleMeetingClick = (id: string) => {
    navigate(`/meetings/${id}`);
  };

  const filteredMeetings = meetings.filter((meeting) =>
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Réunions</h1>
          <p className="text-muted-foreground">Gérer et consulter toutes les réunions</p>
        </header>
        <Button onClick={handleCreateMeeting}>
          <Plus className="mr-2 h-4 w-4" /> Nouvelle Réunion
        </Button>
      </div>

      {/* Composant de préparation de réunion */}
      <MeetingPreparation />

      <Card className="shadow-md hover:shadow-lg transition-shadow bg-white">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2 mb-4">
            <Archive className="h-5 w-5 text-blue-600" />
            Réunions existantes
          </CardTitle>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Rechercher des réunions..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <Card key={item} className="cursor-pointer shadow-md hover:shadow-lg transition-shadow border-2">
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-2/3 mb-2" />
                    <Skeleton className="h-3 w-1/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-3 w-full mb-2" />
                    <Skeleton className="h-3 w-4/5" />
                  </CardContent>
                  <CardFooter>
                    <Skeleton className="h-3 w-1/3" />
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : filteredMeetings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMeetings.map((meeting) => (
                <Card
                  key={meeting.id}
                  className="cursor-pointer shadow-md hover:shadow-lg transition-shadow border-2 bg-white"
                  onClick={() => handleMeetingClick(meeting.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{meeting.title}</CardTitle>
                    <CardDescription>
                      <div className="flex items-center text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(meeting.created_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="text-sm text-muted-foreground">
                      Voir les détails de la réunion, le compte-rendu, le résumé et les tâches
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 rounded-lg border">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Aucune réunion trouvée</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? `Aucune réunion correspondant à "${searchQuery}"`
                  : "Vous n'avez pas encore créé de réunions"}
              </p>
              <Button onClick={handleCreateMeeting}>
                <Plus className="mr-2 h-4 w-4" /> Nouvelle Réunion
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Meetings;
