export interface SpeakingTopicCluster {
  topicTitle: string; // e.g., "Let's talk about your free time activities."
  questions: string[]; // e.g., ["What do you often do in your free time?", ...]
}

export interface SpeakingMindMap {
  centralIdea?: string; // e.g., "Travelling"
  centerTopic?: string; // alias for centralIdea
  nodes: string[]; // e.g., ["Help us make new friends", "Help open our minds", "Help us relax", "[Your own ideas]"]
}

export interface SpeakingTask {
  id: string; // 'speaking-part-1' | 'speaking-part-2' | 'speaking-part-3'
  partNumber: 1 | 2 | 3;
  title: string; // e.g., "PART 1: Social Interaction (3')"
  subtitle?: string;
  durationMinutes: number; // 3 | 4 | 5
  durationLabel?: string;
  prepSeconds: number; // 0 for Part 1, 60 for Part 2 & Part 3
  speakSeconds: number; // 180 for Part 1, 180 for Part 2, 240 for Part 3
  instruction: string;
  // Part 1 specific: 2 social interaction topic clusters
  topicClusters?: SpeakingTopicCluster[];
  // Part 2 specific: Situation & 3 options
  situation?: string;
  options?: string[];
  // Part 3 specific: Topic statement, Mind-map diagram, and 3 follow-up questions
  topicStatement?: string; // e.g., "Travelling has a lot of benefits"
  mindMap?: SpeakingMindMap;
  followUpQuestions?: string[];
  // Optional image & sample answer
  imageUrl?: string;
  imageCaption?: string;
  sampleAnswer?: string;
  vietnameseTranslation?: string;
}

export interface SpeakingPartResponse {
  transcriptText: string;
  wordCount: number;
  audioDataUrl?: string; // Recorded microphone audio (base64 or blob URL)
  durationSeconds?: number;
}

export interface SpeakingSubmission {
  part1Text: string;
  part2Text: string;
  part3Text: string;
  part1WordCount: number;
  part2WordCount: number;
  part3WordCount: number;
  part1AudioUrl?: string;
  part2AudioUrl?: string;
  part3AudioUrl?: string;
  part1AudioDataUrl?: string;
  part2AudioDataUrl?: string;
  part3AudioDataUrl?: string;
  part1DurationSec?: number;
  part2DurationSec?: number;
  part3DurationSec?: number;
  part1DurationSeconds?: number;
  part2DurationSeconds?: number;
  part3DurationSeconds?: number;
}

export const EMPTY_SPEAKING_SUBMISSION: SpeakingSubmission = {
  part1Text: '',
  part2Text: '',
  part3Text: '',
  part1WordCount: 0,
  part2WordCount: 0,
  part3WordCount: 0,
};

export const SAMPLE_VSTEP_SPEAKING_TASKS: SpeakingTask[] = [
  {
    id: 'speaking-part-1',
    partNumber: 1,
    title: "PART 1: Social Interaction (3')",
    durationMinutes: 3,
    prepSeconds: 0,
    speakSeconds: 180,
    instruction:
      'In this part of the speaking test, the examiner will ask you 3–6 questions about TWO familiar topics. Answer naturally with full sentences and reasons.',
    topicClusters: [
      {
        topicTitle: "Let's talk about your free time activities.",
        questions: [
          'What do you often do in your free time?',
          'Do you watch TV? If no, why not? If yes, which TV channel do you like best? Why?',
          'Do you read books? If no, why not? If yes, what kinds of books do you like best? Why?',
        ],
      },
      {
        topicTitle: "Let's talk about your neighborhood.",
        questions: [
          'Can you tell me something about your neighborhood?',
          'What do you like most about it?',
          'Do you plan to live there for a long time? Why/why not?',
        ],
      },
    ],
    vietnameseTranslation:
      'Chủ đề 1: Hoạt động thời gian rảnh (Bạn thường làm gì khi rảnh? Bạn có xem TV không và thích kênh nào nhất? Bạn có đọc sách không và thích thể loại nào nhất?)\nChủ đề 2: Khu phố nơi bạn sống (Hãy kể đôi nét về khu phố của bạn. Điều bạn thích nhất ở đó là gì? Bạn có dự định sống ở đó lâu dài không? Tại sao?)',
    sampleAnswer: `Topic 1: Free time activities
1. In my free time, I usually listen to English podcasts, go jogging in the local park, and spend quality time cooking dinner with my family. These activities help me recharge my batteries after a busy day at work.
2. Yes, I do watch TV occasionally in the evening, and my favorite channel is VTV7, the national educational channel. I like it best because it broadcasts fascinating science documentaries and foreign language programs.
3. Yes, I am an avid reader. I particularly enjoy self-help and biography books because they offer practical life lessons and inspire me to improve my personal and professional skills.

Topic 2: Your neighborhood
1. I live in a peaceful residential area on the outskirts of Ho Chi Minh City. The streets are lined with green trees, and there are convenient supermarkets, local markets, and a public park nearby.
2. What I love most about my neighborhood is the friendly and supportive community. My neighbors always greet each other warmly and are willing to lend a helping hand whenever needed.
3. Yes, I definitely plan to live here for a long time because the living environment is clean, safe, and quiet, which is ideal for raising a family.`,
  },
  {
    id: 'speaking-part-2',
    partNumber: 2,
    title: "PART 2: Solution Discussion (4')",
    durationMinutes: 4,
    prepSeconds: 60,
    speakSeconds: 180,
    instruction:
      'You have 1 minute to prepare and up to 3 minutes to speak. Explain which option you think is the best choice and why you do not choose the other two options.',
    situation:
      'A group of people is planning a trip from Hanoi to Sapa. Three means of transport are suggested: by train, by plane, and by coach. Which means of transport do you think is the best choice?',
    options: ['By train', 'By plane', 'By coach'],
    vietnameseTranslation:
      'Tình huống: Một nhóm bạn đang lên kế hoạch đi du lịch từ Hà Nội lên Sapa. Có 3 phương tiện được gợi ý: đi tàu hỏa (by train), đi máy bay (by plane), và đi xe khách giường nằm (by coach). Theo bạn, phương tiện nào là lựa chọn tốt nhất?',
    sampleAnswer: `Given the situation that a group of friends is planning a trip from Hanoi to Sapa, among the three suggested means of transport—by train, by plane, and by coach—I strongly believe that travelling by coach is the most practical and convenient option.

First of all, taking a modern sleeper or limousine coach via the Hanoi–Lao Cai Expressway takes only about five hours and drops passengers right in the center of Sapa town. Moreover, coach tickets are very affordable for a group of friends, and everyone can sit together, chat, and enjoy the mountain scenery along the way.

On the other hand, I would not choose to travel by plane because Sapa does not have its own commercial airport yet, so flying is not a direct or feasible route from Hanoi. As for travelling by train, although overnight trains are safe, they only stop at Lao Cai Railway Station, which means the group would have to transfer to another bus for an hour along winding mountain roads to reach Sapa town.

In conclusion, for its speed, affordability, and door-to-door convenience, travelling by coach is undoubtedly the best choice for this trip.`,
  },
  {
    id: 'speaking-part-3',
    partNumber: 3,
    title: "PART 3: Topic Development (5')",
    durationMinutes: 5,
    prepSeconds: 60,
    speakSeconds: 240,
    instruction:
      'You have 1 minute to prepare your talk based on the mind-map below, then speak for 2–3 minutes and answer the follow-up discussion questions.',
    topicStatement: 'Travelling has a lot of benefits',
    mindMap: {
      centralIdea: 'Travelling',
      nodes: [
        'Help us make new friends',
        'Help open our minds',
        'Help us relax',
        '[Your own ideas]',
      ],
    },
    followUpQuestions: [
      'What are the differences in the way to travel between your generation and your grandparents?',
      'Can you compare the tourist trips of local people and foreign visitors in your country?',
      'In what ways can we reduce the negative effects of tourism?',
    ],
    vietnameseTranslation:
      'Chủ đề: Đi du lịch mang lại rất nhiều lợi ích (Sơ đồ: Giúp kết thêm bạn mới · Giúp mở mang tầm mắt · Giúp thư giãn · Ý kiến riêng của bạn).\nCâu hỏi thảo luận: 1) Sự khác biệt trong cách đi du lịch giữa thế hệ của bạn và thế hệ ông bà là gì? 2) So sánh chuyến du lịch của khách nội địa và khách quốc tế tại Việt Nam? 3) Làm thế nào để giảm thiểu tác động tiêu cực của du lịch?',
    sampleAnswer: `Part 3 Monologue:
I completely agree with the statement that travelling brings numerous benefits to our lives.

First and foremost, travelling helps us relax and relieve stress. Stepping away from our daily routine and hectic work schedule allows us to immerse ourselves in nature, breathe fresh air, and recharge both our physical and mental energy.

Secondly, travelling opens our minds and broadens our horizons. When we visit new destinations, we experience different cultures, historical landmarks, and local cuisines first-hand, which teaches us tolerance and appreciation for cultural diversity.

Thirdly, travelling gives us wonderful opportunities to make new friends. Whether we join group tours or stay at local homestays, we meet people from all walks of life and build meaningful friendships. In addition, from my own perspective, travelling boosts our independence and problem-solving skills when navigating unfamiliar places.

Follow-up Questions:
1. Compared to my grandparents' generation, young people today travel much more frequently and independently. Thanks to smartphones, online booking apps, and budget airlines, our generation prefers solo travel or adventure trips, whereas our grandparents mostly travelled in organized family groups on rare occasions.
2. Local tourists in Vietnam often prefer short weekend getaways to cool mountain resorts or beach cities with family and focus on relaxation and seafood, while foreign visitors usually take longer backpacking or cultural tours to explore heritage sites, ethnic villages, and authentic street food.
3. To reduce the negative impacts of tourism, governments should enforce strict environmental laws at tourist attractions, while travellers should practice eco-friendly habits such as refusing single-use plastics and respecting local customs.`,
  },
];
