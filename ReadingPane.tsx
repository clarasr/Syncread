import { ReadingPane } from '../ReadingPane';
import { useState } from 'react';

const mockContent = `The old library stood silent in the heart of the city, its towering shelves holding thousands of stories waiting to be discovered. Sarah pushed open the heavy oak door, breathing in the familiar scent of aged paper and leather bindings. She had come here every week since childhood, finding solace among the whispered pages. Today felt different somehow, as if the books themselves were calling to her with urgent voices. Her fingers traced the spines as she walked deeper into the maze of knowledge, searching for something she couldn't quite name.`;

export default function ReadingPaneExample() {
  const [highlightedIndex, setHighlightedIndex] = useState(2);

  // Simulate auto-progression
  setTimeout(() => {
    setHighlightedIndex((prev) => (prev + 1) % 5);
  }, 3000);

  return (
    <div className="h-96">
      <ReadingPane
        content={mockContent}
        highlightedSentenceIndex={highlightedIndex}
        chapterTitle="Chapter 1: The Discovery"
      />
    </div>
  );
}
