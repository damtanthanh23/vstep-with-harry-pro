export interface WritingTask {
  id: string;
  partNumber: 1 | 2;
  title: string;
  instruction: string;
  stimulusText?: string;
  imageUrl?: string;
  imageCaption?: string;
  bulletPoints: string[];
  minWords: number;
  maxWords: number;
  marks: number;
  sampleAnswer?: string;
}

export interface WritingSubmission {
  task1Text: string;
  task2Text: string;
  task1WordCount: number;
  task2WordCount: number;
}

export const SAMPLE_B1_WRITING_TASKS: WritingTask[] = [
  {
    id: 'task-1',
    partNumber: 1,
    title: 'VSTEP Writing Task 1: Letter / Email Writing (20 phút · Trọng số 1/3)',
    instruction:
      'You should spend about 20 minutes on this task. You received an email from your uncle, Hung. He asked you for some information about one of your cousins. Read part of his email below.',
    stimulusText:
      "I've just got an email from my cousin, An. He said he's going to take a course in Ho Chi Minh City this summer. He asked if he could stay with my family until he could find an apartment. Can you tell me a bit about him? (things like his personality, hobbies and interests, and his current work or study if possible) I want to see if he will fit in with my family.",
    bulletPoints: [
      "Describe An's personality (friendly, tidy, considerate, etc.)",
      "Mention his hobbies and interests in his free time",
      "Provide details about his current study or work and summer course in Ho Chi Minh City",
    ],
    minWords: 120,
    maxWords: 180,
    marks: 10,
    sampleAnswer:
      "Dear Uncle Hung,\n\nI hope you and your family are doing well. I am writing this email in response to your questions about our cousin, An, who is planning to take a short summer course in Ho Chi Minh City.\n\nFirst of all, regarding his personality, An is a very polite, cheerful, and responsible young man. He is always tidy and respectful of other people's living spaces, so I am sure he will get along wonderfully with everyone in your house.\n\nIn terms of his hobbies and interests, he really enjoys reading books about technology, playing badminton on weekends, and cooking simple meals. Whenever he stays with us, he often helps my mother prepare dinner.\n\nCurrently, An is a third-year Information Technology student at Hanoi University of Science and Technology. This summer, he is attending an intensive two-month software development course in District 1.\n\nI strongly believe he will fit in well with your family. Please let me know if you need any further information.\n\nWarm regards,\nMinh",
  },
  {
    id: 'task-2',
    partNumber: 2,
    title: 'VSTEP Writing Task 2: Essay Writing (40 phút · Trọng số 2/3)',
    instruction:
      'You should spend about 40 minutes on this task. Write an essay of at least 250 words about the following topic:',
    stimulusText:
      'In order to solve traffic problems in major cities in Viet Nam, the government should strictly limit roadway encroachment and improve transport infrastructure.\nWhat problems are associated with this and what are some possible solutions?\nTo what extent do you agree with this statement?',
    bulletPoints: [
      'Analyze the main traffic problems caused by roadway encroachment and weak infrastructure in major Vietnamese cities',
      'Evaluate the proposed government measures (strictly limiting pavement/roadway encroachment and upgrading public transport infrastructure)',
      'State your degree of agreement and suggest practical complementary solutions (e.g., expanding metro/bus networks, raising public awareness)',
    ],
    minWords: 250,
    maxWords: 350,
    marks: 10,
    sampleAnswer:
      'In recent decades, traffic congestion and road safety have become pressing issues in major Vietnamese cities such as Hanoi and Ho Chi Minh City. Many people argue that the government should strictly prohibit roadway encroachment and upgrade transport infrastructure to tackle this crisis. I completely agree with this viewpoint, while also believing that additional long-term measures are needed.\n\nOn the one hand, roadway and sidewalk encroachment causes severe traffic bottlenecks and safety hazards. In many urban streets, vendors and shop owners occupy pavements for business, forcing pedestrians to walk directly onto the roadway. This not only slows down vehicle flow during peak hours but also increases the risk of traffic accidents. Furthermore, outdated road networks and narrow intersections cannot cope with the rapid growth of private motorbikes and cars.\n\nOn the other hand, strictly enforcing anti-encroachment laws and investing in modern transport infrastructure offer sustainable solutions. First, clearing sidewalks and imposing heavy fines on illegal street parking will immediately restore space for pedestrians and smooth traffic flow. Second, upgrading infrastructure by building ring roads, overpasses, and metro lines will significantly reduce pressure on inner-city streets. However, one challenge associated with clearing sidewalks is that many street vendors rely on them for their livelihood. Therefore, local authorities should designate legal night markets or dedicated trading zones for small vendors.\n\nIn conclusion, I strongly agree that curbing roadway encroachment and improving transport infrastructure are essential steps to solving urban traffic problems in Viet Nam. Combined with better public transport and higher commuter awareness, these policies will make our cities safer and more livable.',
  },
];
