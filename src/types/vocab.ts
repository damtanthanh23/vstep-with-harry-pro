import { VocabItem } from '../data/b1VocabData';

export type VocabDeckCategoryType = '15_topics' | 'exam_test' | 'custom_topic' | 'untagged';

export interface ExtendedVocabItem extends VocabItem {
  collocations?: string;
  note?: string;
  isMastered?: boolean;
  deckId?: string;
  srsLevel?: number;
  addedAt?: number;
  examSection?: string;
  linkedTestId?: string;
  linkedTestTitle?: string;
}

export interface UserVocabDeck {
  id: string;
  name: string;
  description?: string;
  icon: string;
  folderId?: string;
  categoryType?: VocabDeckCategoryType;
  officialTopicCode?: string;
  linkedTestId?: string;
  linkedTestTitle?: string;
  customTopicTag?: string;
  isPinned?: boolean;
  itemCount: number;
  items: ExtendedVocabItem[];
  createdAt: number;
  updatedAt: number;
}

export interface UserVocabFolder {
  id: string;
  name: string;
  deckIds: string[];
  createdAt: number;
}

export interface VocabSrsRecord {
  wordId: string;
  intervalDays: number;
  repetition: number;
  easeFactor: number;
  dueAt: number; // timestamp ms
  lastRatedAt: number;
  status: 'new' | 'learning' | 'review' | 'mastered';
}

export type VocabGameMode =
  | 'flashcard'
  | 'quiz'
  | 'match'
  | 'spell'
  | 'dictation'
  | 'mixed'
  | 'srs';

export interface VocabRoadmap {
  id: string;
  title: string;
  category: '15_topics' | 'exam_parts' | 'levels';
  difficulty: number; // 1 to 5
  totalDecks: number;
  totalWords: number;
  description: string;
  isPinned?: boolean;
  tags: string[];
  sampleItems: ExtendedVocabItem[];
}

export const EMOJI_ICON_OPTIONS = [
  '📚', '📖', '📝', '✏️', '📕', '⭐', '🎯', '💡', '🔥', '💎', '🎓', '🌟'
];

export const OFFICIAL_15_TOPICS: string[] = [
  '01 Personal Identification',
  '02 House, Home And Local Area',
  '03 Daily Life & Free Time',
  '04 Free Time, Entertainment',
  '05 Travel & Transport',
  '06 Relations With Other People',
  '07 Health & Body Care',
  '08 Education & Study',
  '09 Shopping & Services',
  '10 Food & Drink',
  '11 Services (Bank, Post, Hotel)',
  '12 Places & Locations',
  '13 Language & Communication',
  '14 Weather & Environment',
  '15 Science & Technology',
];

export const CURATED_ROADMAPS: VocabRoadmap[] = [
  {
    id: 'roadmap_b1_master',
    title: 'LanguageCert B1 Achiever Master Roadmap',
    category: 'levels',
    difficulty: 3,
    totalDecks: 15,
    totalWords: 450,
    description: 'Lộ trình toàn diện chuẩn hóa 15 chủ đề cốt lõi theo syllabus LanguageCert B1.',
    isPinned: true,
    tags: ['B1 Achiever', 'Toàn diện', 'Chính thức'],
    sampleItems: [
      {
        id: 'rm_1',
        word: 'accommodation',
        phonetic: '/əˌkɒm.əˈdeɪ.ʃən/',
        partOfSpeech: 'n',
        meaningVi: 'chỗ ở, phòng trọ',
        exampleEn: 'Hotel accommodation is included in the tour price.',
        exampleVi: 'Chỗ ở khách sạn đã được bao gồm trong giá tour.',
        topic: '02 House, Home And Local Area',
        cefr: 'B1',
        collocations: 'book accommodation, temporary accommodation',
        note: 'Hay xuất hiện trong Reading Part 1 & Listening Part 2',
      },
      {
        id: 'rm_2',
        word: 'destination',
        phonetic: '/ˌdes.tɪˈneɪ.ʃən/',
        partOfSpeech: 'n',
        meaningVi: 'điểm đến, đích đến',
        exampleEn: 'Paris is a popular tourist destination.',
        exampleVi: 'Paris là một điểm đến du lịch nổi tiếng.',
        topic: '05 Travel And Transport',
        cefr: 'B1',
        collocations: 'holiday destination, popular destination',
        note: 'Xuất hiện trong Reading Part 3 & 4',
      },
    ],
  },
  {
    id: 'roadmap_listening_parts',
    title: 'Listening Parts 1-4 Từ Vựng Bẫy & Cụm Đồng Nghĩa',
    category: 'exam_parts',
    difficulty: 3,
    totalDecks: 8,
    totalWords: 240,
    description: 'Tổng hợp từ vựng hay xuất hiện trong hội thoại ngắn, chỉ dẫn đường và phỏng vấn đài.',
    isPinned: true,
    tags: ['Listening', 'Paraphrasing', 'Phản xạ'],
    sampleItems: [
      {
        id: 'rm_l1',
        word: 'postpone',
        phonetic: '/pəʊstˈpəʊn/',
        partOfSpeech: 'v',
        meaningVi: 'hoãn lại, dời lịch',
        exampleEn: 'The outdoor match was postponed because of heavy rain.',
        exampleVi: 'Trận đấu ngoài trời đã bị hoãn lại vì mưa lớn.',
        topic: 'Listening Part 2',
        cefr: 'B1',
        collocations: 'postpone a meeting, postpone an event',
        note: 'Đồng nghĩa: put off, delay',
      },
      {
        id: 'rm_l2',
        word: 'apologise',
        phonetic: '/əˈpɒl.ə.dʒaɪz/',
        partOfSpeech: 'v',
        meaningVi: 'xin lỗi, tạ lỗi',
        exampleEn: 'He apologised for being late to the interview.',
        exampleVi: 'Anh ấy xin lỗi vì đã đến muộn buổi phỏng vấn.',
        topic: 'Listening Part 1',
        cefr: 'B1',
        collocations: 'apologise for something, apologise to someone',
        note: 'Bẫy thường gặp trong đáp lại câu hỏi Part 1',
      },
    ],
  },
  {
    id: 'roadmap_reading_parts',
    title: 'Reading Parts 1-4 Biển Báo, Email & Văn Bản Dài',
    category: 'exam_parts',
    difficulty: 3,
    totalDecks: 10,
    totalWords: 300,
    description: 'Từ vựng thông báo công cộng, thư điện tử công việc và bài đọc khoa học xã hội.',
    tags: ['Reading', 'Biển báo', 'Gapped Text'],
    sampleItems: [
      {
        id: 'rm_r1',
        word: 'requirement',
        phonetic: '/rɪˈkwaɪə.mənt/',
        partOfSpeech: 'n',
        meaningVi: 'yêu cầu, điều kiện bắt buộc',
        exampleEn: 'A passport is a minimum requirement for overseas travel.',
        exampleVi: 'Hộ chiếu là điều kiện tối thiểu cho chuyến đi nước ngoài.',
        topic: 'Reading Part 1',
        cefr: 'B1',
        collocations: 'meet requirements, entry requirement',
        note: 'Rất hay xuất hiện trong biển báo quy định',
      },
      {
        id: 'rm_r2',
        word: 'fortunately',
        phonetic: '/ˈfɔː.tʃən.ət.li/',
        partOfSpeech: 'adv',
        meaningVi: 'may mắn thay, thật may',
        exampleEn: 'Fortunately, nobody was hurt during the incident.',
        exampleVi: 'May mắn thay, không ai bị thương trong sự cố.',
        topic: 'Reading Part 2',
        cefr: 'B1',
        collocations: 'fortunately enough',
        note: 'Từ nối điền ô trống Reading Part 2',
      },
    ],
  },
  {
    id: 'roadmap_writing_boost',
    title: 'Writing B1 Từ Nối & Cụm Diễn Đạt Tự Nhiên',
    category: 'exam_parts',
    difficulty: 4,
    totalDecks: 6,
    totalWords: 180,
    description: 'Các liên từ, cụm từ chỉ quan điểm, mở bài & kết bài thư trang trọng và thân mật.',
    tags: ['Writing', 'Task 1 & 2', 'Từ nối'],
    sampleItems: [
      {
        id: 'rm_w1',
        word: 'furthermore',
        phonetic: '/ˌfɜː.ðəˈmɔːr/',
        partOfSpeech: 'adv',
        meaningVi: 'hơn nữa, thêm vào đó',
        exampleEn: 'He is lazy, and furthermore, he has no desire to learn.',
        exampleVi: 'Anh ấy lười, và hơn nữa, anh ấy không có mong muốn học tập.',
        topic: 'Writing Part 2',
        cefr: 'B1',
        collocations: 'furthermore, in addition',
        note: 'Dùng cho bài luận để bổ sung luận điểm',
      },
      {
        id: 'rm_w2',
        word: 'appreciate',
        phonetic: '/əˈpriː.ʃi.eɪt/',
        partOfSpeech: 'v',
        meaningVi: 'đánh giá cao, cảm kích',
        exampleEn: 'I would appreciate it if you could reply soon.',
        exampleVi: 'Tôi sẽ rất cảm kích nếu bạn có thể phản hồi sớm.',
        topic: 'Writing Part 1',
        cefr: 'B1',
        collocations: 'greatly appreciate, appreciate your help',
        note: 'Mẫu câu vàng kết thư trang trọng',
      },
    ],
  },
  {
    id: 'roadmap_topic_01',
    title: 'Chủ đề 01: Personal Identification',
    category: '15_topics',
    difficulty: 2,
    totalDecks: 4,
    totalWords: 120,
    description: 'Nhận dạng cá nhân, lý lịch, nghề nghiệp, tính cách và sở thích cơ bản.',
    tags: ['Chủ đề B1', 'Nhận dạng', 'Giao tiếp'],
    sampleItems: [
      {
        id: 'rm_t1',
        word: 'occupation',
        phonetic: '/ˌɒk.jəˈpeɪ.ʃən/',
        partOfSpeech: 'n',
        meaningVi: 'nghề nghiệp, công việc',
        exampleEn: 'Please state your name, age, and occupation on the form.',
        exampleVi: 'Vui lòng ghi rõ họ tên, tuổi và nghề nghiệp vào đơn.',
        topic: '01 Personal Identification',
        cefr: 'B1',
        collocations: 'current occupation, professional occupation',
        note: 'Từ đồng nghĩa trang trọng của job',
      },
    ],
  },
  {
    id: 'roadmap_topic_02',
    title: 'Chủ đề 02: House, Home And Local Area',
    category: '15_topics',
    difficulty: 2,
    totalDecks: 4,
    totalWords: 120,
    description: 'Nhà ở, tiện ích khu dân cư, thuê phòng và đồ đạc gia đình.',
    tags: ['Chủ đề B1', 'Nhà ở', 'Địa phương'],
    sampleItems: [
      {
        id: 'rm_t2',
        word: 'neighbourhood',
        phonetic: '/ˈneɪ.bə.hʊd/',
        partOfSpeech: 'n',
        meaningVi: 'khu dân cư, khu phố lân cận',
        exampleEn: 'We live in a friendly and quiet neighbourhood.',
        exampleVi: 'Chúng tôi sống ở một khu phố thân thiện và yên tĩnh.',
        topic: '02 House, Home And Local Area',
        cefr: 'B1',
        collocations: 'safe neighbourhood, peaceful neighbourhood',
        note: 'Rất hay xuất hiện trong Reading Part 4',
      },
    ],
  },
  {
    id: 'roadmap_topic_05',
    title: 'Chủ đề 05: Travel And Transport',
    category: '15_topics',
    difficulty: 3,
    totalDecks: 5,
    totalWords: 150,
    description: 'Du lịch, phương tiện công cộng, sân bay, vé tàu và hành trình.',
    tags: ['Chủ đề B1', 'Du lịch', 'Vé tàu'],
    sampleItems: [
      {
        id: 'rm_t5',
        word: 'passenger',
        phonetic: '/ˈpæs.ən.dʒər/',
        partOfSpeech: 'n',
        meaningVi: 'hành khách',
        exampleEn: 'All passengers for flight LC202 please proceed to Gate 5.',
        exampleVi: 'Tất cả hành khách chuyến bay LC202 vui lòng đến Cổng số 5.',
        topic: '05 Travel And Transport',
        cefr: 'B1',
        collocations: 'train passenger, airline passenger',
        note: 'Thường xuất hiện trong loa phát thanh sân bay Listening Part 2',
      },
    ],
  },
  {
    id: 'roadmap_level_starter',
    title: 'Từ Vựng Nền Tảng Cần Thiết (A2 - B1 Starter)',
    category: 'levels',
    difficulty: 1,
    totalDecks: 6,
    totalWords: 180,
    description: 'Ôn chắc các động từ bất quy tắc, từ nối cơ bản và trạng từ tần suất.',
    tags: ['Nền tảng', 'A2 lên B1', 'Căn bản'],
    sampleItems: [
      {
        id: 'rm_s1',
        word: 'convenient',
        phonetic: '/kənˈviː.ni.ənt/',
        partOfSpeech: 'adj',
        meaningVi: 'tiện lợi, thuận tiện',
        exampleEn: 'Public transport is fast and convenient in this city.',
        exampleVi: 'Giao thông công cộng ở thành phố này rất nhanh và tiện lợi.',
        topic: 'General B1',
        cefr: 'B1',
        collocations: 'convenient time, convenient location',
        note: 'Từ thiết yếu cho mọi kỹ năng',
      },
    ],
  },
  {
    id: 'roadmap_level_advanced',
    title: 'Từ Vựng Bứt Phá Điểm Cao B1 Achiever (High Pass)',
    category: 'levels',
    difficulty: 5,
    totalDecks: 8,
    totalWords: 240,
    description: 'Từ vựng học thuật, thành ngữ thông dụng và collocations nâng cao để đạt điểm High Pass.',
    tags: ['Bứt phá', 'High Pass', 'Collocations'],
    sampleItems: [
      {
        id: 'rm_adv1',
        word: 'substantial',
        phonetic: '/səbˈstæn.ʃəl/',
        partOfSpeech: 'adj',
        meaningVi: 'đáng kể, quan trọng',
        exampleEn: 'There has been a substantial increase in public funding.',
        exampleVi: 'Đã có sự gia tăng đáng kể trong ngân sách công.',
        topic: 'Academic B1+',
        cefr: 'B1',
        collocations: 'substantial difference, substantial amount',
        note: 'Nâng band điểm Lexis trong bài Writing',
      },
    ],
  },
];

export const COMMUNITY_DECKS: UserVocabDeck[] = [
  {
    id: 'comm_deck_1',
    name: 'Top 50 Cụm Từ Bẫy Nghe LanguageCert B1',
    description: 'Được đóng gói bởi Giảng viên LanguageCert, gom các từ đồng âm và từ dễ nhầm lẫn.',
    icon: '🎧',
    itemCount: 50,
    createdAt: Date.now() - 86400000 * 5,
    updatedAt: Date.now() - 86400000 * 2,
    items: [
      {
        id: 'cm1_1',
        word: 'receipt',
        phonetic: '/rɪˈsiːt/',
        partOfSpeech: 'n',
        meaningVi: 'hóa đơn, biên lai',
        exampleEn: 'Keep your receipt in case you need to return the item.',
        exampleVi: 'Hãy giữ lại biên lai phòng khi bạn cần trả lại hàng.',
        topic: '08 Shopping',
        cefr: 'B1',
        collocations: 'keep the receipt, sales receipt',
        note: 'Âm p câm, hay bị nhầm lẫn với recipe',
      },
      {
        id: 'cm1_2',
        word: 'recipe',
        phonetic: '/ˈres.ɪ.pi/',
        partOfSpeech: 'n',
        meaningVi: 'công thức nấu ăn',
        exampleEn: 'Can you share the recipe for this delicious apple pie?',
        exampleVi: 'Bạn có thể chia sẻ công thức cho món bánh táo ngon này không?',
        topic: '09 Food And Drink',
        cefr: 'B1',
        collocations: 'follow a recipe, secret recipe',
        note: 'Phát âm 3 âm tiết',
      },
      {
        id: 'cm1_3',
        word: 'borrow',
        phonetic: '/ˈbɒr.əʊ/',
        partOfSpeech: 'v',
        meaningVi: 'mượn (từ ai)',
        exampleEn: 'Can I borrow your English dictionary for a moment?',
        exampleVi: 'Tôi có thể mượn từ điển tiếng Anh của bạn một lát không?',
        topic: 'Services',
        cefr: 'B1',
        collocations: 'borrow money, borrow books',
        note: 'Tránh nhầm với lend (cho mượn)',
      },
      {
        id: 'cm1_4',
        word: 'lend',
        phonetic: '/lend/',
        partOfSpeech: 'v',
        meaningVi: 'cho mượn, cho vay',
        exampleEn: 'The bank refused to lend him any money.',
        exampleVi: 'Ngân hàng từ chối cho anh ấy vay tiền.',
        topic: 'Services',
        cefr: 'B1',
        collocations: 'lend a hand, lend money',
        note: 'lend someone something / lend something to someone',
      },
    ],
  },
  {
    id: 'comm_deck_2',
    name: '100 Từ Vựng Thư Tín & Email Công Việc B1',
    description: 'Từ vựng viết email gửi giáo viên, quản lý, xin nghỉ phép, phàn nàn dịch vụ.',
    icon: '📝',
    itemCount: 100,
    createdAt: Date.now() - 86400000 * 12,
    updatedAt: Date.now() - 86400000 * 3,
    items: [
      {
        id: 'cm2_1',
        word: 'enquiry',
        phonetic: '/ɪnˈkwaɪə.ri/',
        partOfSpeech: 'n',
        meaningVi: 'sự hỏi han, yêu cầu thông tin',
        exampleEn: 'We received your enquiry regarding course fees.',
        exampleVi: 'Chúng tôi đã nhận được câu hỏi của bạn về học phí khóa học.',
        topic: 'Services',
        cefr: 'B1',
        collocations: 'make an enquiry, reply to an enquiry',
        note: 'Rất thông dụng trong Writing Part 1',
      },
      {
        id: 'cm2_2',
        word: 'confirm',
        phonetic: '/kənˈfɜːm/',
        partOfSpeech: 'v',
        meaningVi: 'xác nhận, khẳng định lại',
        exampleEn: 'Please write back to confirm your attendance at the dinner.',
        exampleVi: 'Vui lòng hồi âm để xác nhận sự có mặt của bạn tại bữa tối.',
        topic: 'Services',
        cefr: 'B1',
        collocations: 'confirm a booking, confirm details',
        note: 'Xuất hiện trong cả 4 kỹ năng',
      },
    ],
  },
  {
    id: 'comm_deck_3',
    name: 'Từ Vựng Đời Sống & Mua Sắm (Shopping & Food)',
    description: 'Tất tần tật từ vựng về siêu thị, giá cả, thanh toán, gọi món nhà hàng.',
    icon: '🛒',
    itemCount: 75,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 7,
    items: [
      {
        id: 'cm3_1',
        word: 'discount',
        phonetic: '/ˈdɪs.kaʊnt/',
        partOfSpeech: 'n',
        meaningVi: 'giảm giá, chiết khấu',
        exampleEn: 'Students can get a 10% discount on all books.',
        exampleVi: 'Sinh viên được giảm giá 10% cho tất cả các loại sách.',
        topic: '08 Shopping',
        cefr: 'B1',
        collocations: 'special discount, offering discounts',
        note: 'Listening Part 1 thường có câu hỏi tính toán giá sau giảm',
      },
      {
        id: 'cm3_2',
        word: 'ingredient',
        phonetic: '/ɪnˈɡriː.di.ənt/',
        partOfSpeech: 'n',
        meaningVi: 'thành phần, nguyên liệu món ăn',
        exampleEn: 'Fresh vegetables are essential ingredients for a healthy salad.',
        exampleVi: 'Rau tươi là nguyên liệu thiết yếu cho món salad lành mạnh.',
        topic: '09 Food And Drink',
        cefr: 'B1',
        collocations: 'fresh ingredients, key ingredient',
        note: 'Reading Part 3 về ẩm thực',
      },
    ],
  },
];
