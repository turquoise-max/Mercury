import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Article {
  title: string;
  url: string;
  content: string;
}

interface SearchParams {
  topic: string;
  articleCount: number;
}

interface GenerateParams {
  topic: string;
  main_news: Article[];
  sponsor_text?: string | null;
  prompt_of_the_day?: string | null;
  onStatusChange?: (status: string) => void;
}

export const useSearchArticles = () => {
  return useMutation({
    mutationFn: async ({ topic, articleCount }: SearchParams) => {
      const response = await fetch("http://localhost:8000/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          article_count: articleCount,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMessage = typeof errData.detail === 'object' ? JSON.stringify(errData.detail) : (errData.detail || "Failed to search articles");
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (!data.articles || data.articles.length === 0) {
        toast.info("검색 결과가 없습니다. 다른 주제로 시도해보세요.");
      } else {
        toast.success(`${data.articles.length}개의 기사를 찾았습니다.`);
      }
    },
    onError: (error: any) => {
      console.error("Error searching articles:", error);
      toast.error(`기사 검색 중 오류가 발생했습니다: ${error.message}`);
    },
  });
};

export const useGenerateNewsletter = () => {
  return useMutation({
    mutationFn: async ({ topic, main_news, sponsor_text, prompt_of_the_day, onStatusChange }: GenerateParams) => {
      if (onStatusChange) {
        onStatusChange("기사 읽는 중...");
      }

      const response = await fetch("http://localhost:8000/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          main_news,
          sponsor_text,
          prompt_of_the_day,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errorMessage = typeof errData.detail === 'object' ? JSON.stringify(errData.detail) : (errData.detail || "Failed to generate newsletter");
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("뉴스레터 생성이 완료되었습니다.");
    },
    onError: (error: any) => {
      console.error("Error generating newsletter:", error);
      toast.error(`뉴스레터 생성 중 오류가 발생했습니다: ${error.message}`);
    },
  });
};