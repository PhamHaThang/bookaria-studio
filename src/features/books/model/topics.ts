/** Shared author-facing subjects; persisted as text for compatibility with existing books. */
export const BOOK_TOPICS = [
    'Khoa học tự nhiên',
    'Toán học',
    'Công nghệ & lập trình',
    'Ngôn ngữ & ngoại ngữ',
    'Văn học & truyện kể',
    'Lịch sử',
    'Địa lý',
    'Văn hóa & di sản',
    'Thiên nhiên & môi trường',
    'Động vật & thực vật',
    'Nghệ thuật & sáng tạo',
    'Âm nhạc',
    'Sức khỏe & cơ thể',
    'Kỹ năng sống',
    'Cảm xúc & các mối quan hệ',
    'Nghề nghiệp',
    'Du lịch & khám phá',
    'Thể thao & vận động',
    'Kinh doanh & tài chính',
    'Ẩm thực & đời sống',
] as const;

export const OTHER_BOOK_TOPIC = '__other_topic__';
export const bookTopicOptions = [
    { value: '', label: 'Chưa chọn chủ đề' },
    ...BOOK_TOPICS.map((topic) => ({ value: topic, label: topic })),
    { value: OTHER_BOOK_TOPIC, label: 'Khác' },
];
export function bookTopicChoice(topic: string) {
    return !topic.trim()
        ? ''
        : BOOK_TOPICS.some((item) => item === topic.trim())
          ? topic.trim()
          : OTHER_BOOK_TOPIC;
}
