
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calendar, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

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
        console.error("Error fetching meetings:", error);
        toast({
          title: "Error loading meetings",
          description: error.message || "Please try again later",
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
        <div>
          <h1 className="text-2xl font-bold">Meetings</h1>
          <p className="text-muted-foreground">Manage and view all meetings</p>
        </div>
        <Button onClick={handleCreateMeeting}>
          <Plus className="mr-2 h-4 w-4" /> New Meeting
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search meetings..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Card key={item} className="cursor-pointer hover:shadow-md transition-shadow">
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
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleMeetingClick(meeting.id)}
            >
              <CardHeader className="pb-2">
                <CardTitle>{meeting.title}</CardTitle>
                <CardDescription>
                  <div className="flex items-center text-xs">
                    <Calendar className="h-3 w-3 mr-1" />
                    {format(new Date(meeting.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-sm text-muted-foreground">
                  View meeting details, transcript, summary, and to-dos
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-1">No meetings found</h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? `No meetings matching "${searchQuery}"`
              : "You haven't created any meetings yet"}
          </p>
          <Button onClick={handleCreateMeeting}>
            <Plus className="mr-2 h-4 w-4" /> Create Meeting
          </Button>
        </div>
      )}
    </div>
  );
};

export default Meetings;
