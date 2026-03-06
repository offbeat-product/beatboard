import { useState } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TrendingUp, BarChart3, Users, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import Management from "./Management";
import Productivity from "./Productivity";
import Customers from "./Customers";
import Quality from "./Quality";

const Index = () => {
  usePageTitle("ダッシュボード");
  const [tab, setTab] = useState("management");

  return (
    <div className="space-y-4">
      <PageHeader title="ダッシュボード" />

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start bg-muted/50 p-1 h-auto flex-wrap gap-1 overflow-x-auto">
          <TabsTrigger value="management" className="gap-1.5 text-xs sm:text-sm">
            <TrendingUp className="h-3.5 w-3.5" />
            経営指標
          </TabsTrigger>
          <TabsTrigger value="productivity" className="gap-1.5 text-xs sm:text-sm">
            <BarChart3 className="h-3.5 w-3.5" />
            生産性指標
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            顧客指標
          </TabsTrigger>
          <TabsTrigger value="quality" className="gap-1.5 text-xs sm:text-sm">
            <CheckCircle className="h-3.5 w-3.5" />
            品質指標
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="mt-4">
          <Management embedded />
        </TabsContent>
        <TabsContent value="productivity" className="mt-4">
          <Productivity embedded />
        </TabsContent>
        <TabsContent value="customers" className="mt-4">
          <Customers embedded />
        </TabsContent>
        <TabsContent value="quality" className="mt-4">
          <Quality embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
