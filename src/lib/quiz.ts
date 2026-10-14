/**
 * Quiz marking rules, kept in one place so the learner view, the attempt
 * validation and the admin review all agree.
 *
 *  single      one correct option, full points or nothing
 *  multiple    exact set match (all-or-nothing)
 *  truefalse   one correct option
 *  short       case-insensitive, whitespace-normalised match against accepted answers
 *  essay       always manual: the attempt stays "pending review" until an admin marks it
 */

export type QuestionKind = 'single' | 'multiple' | 'truefalse' | 'short' | 'essay';

export interface QuizQuestion {
  id: number;
  type: QuestionKind;
  prompt: string;
  options: string[];
  correct: (number | string)[];
  explanation: string;
  points: number;
}

export interface SubmittedAnswer {
  questionId: number;
  /** choice indexes for single/multiple/truefalse */
  choices?: number[];
  /** free text for short/essay */
  text?: string;
}

export interface MarkedAnswer {
  questionId: number;
  answer: SubmittedAnswer;
  awardedPoints: number | null;
  isCorrect: boolean | null;
  /** the message shown to the learner after submit */
  feedback: string;
}

export interface MarkResult {
  answers: MarkedAnswer[];
  autoPoints: number;
  autoMax: number;
  manualMax: number;
  maxPoints: number;
  hasManualQuestion: boolean;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function indexes(answer: SubmittedAnswer | undefined): number[] {
  return (answer?.choices ?? []).filter((index) => Number.isInteger(index)).sort((a, b) => a - b);
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function markAnswers(questions: QuizQuestion[], answers: SubmittedAnswer[]): MarkResult {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));

  const marked: MarkedAnswer[] = questions.map((question) => {
    const answer = byId.get(question.id) ?? { questionId: question.id };
    const correctIndexes = (question.correct as number[]).filter((value) => typeof value === 'number').sort((a, b) => a - b);
    const accepted = (question.correct as string[]).filter((value) => typeof value === 'string');

    switch (question.type) {
      case 'single':
      case 'truefalse': {
        const chosen = indexes(answer);
        const isCorrect = sameSet(chosen, correctIndexes);
        return {
          questionId: question.id,
          answer,
          awardedPoints: isCorrect ? question.points : 0,
          isCorrect,
          feedback: isCorrect
            ? 'Correct.'
            : `Not quite - the correct answer is "${question.options[correctIndexes[0]] ?? ''}".`,
        };
      }
      case 'multiple': {
        const chosen = indexes(answer);
        const isCorrect = sameSet(chosen, correctIndexes);
        return {
          questionId: question.id,
          answer,
          awardedPoints: isCorrect ? question.points : 0,
          isCorrect,
          feedback: isCorrect
            ? 'Correct.'
            : `Not quite - the correct options are ${correctIndexes
                .map((index) => `"${question.options[index] ?? ''}"`)
                .join(', ')}.`,
        };
      }
      case 'short': {
        const given = normalise(answer.text ?? '');
        const isCorrect = given.length > 0 && accepted.some((value) => normalise(value) === given);
        return {
          questionId: question.id,
          answer,
          awardedPoints: isCorrect ? question.points : 0,
          isCorrect,
          feedback: isCorrect
            ? 'Correct.'
            : `Accepted answers: ${accepted.join(', ')}.`,
        };
      }
      case 'essay':
      default: {
        return {
          questionId: question.id,
          answer,
          awardedPoints: null,
          isCorrect: null,
          feedback: 'Your instructor will mark this answer.',
        };
      }
    }
  });

  const auto = marked.filter((answer) => answer.awardedPoints !== null);
  const manual = marked.filter((answer) => answer.awardedPoints === null);

  return {
    answers: marked,
    autoPoints: auto.reduce((sum, answer) => sum + (answer.awardedPoints ?? 0), 0),
    autoMax: auto.reduce((sum, answer) => {
      const question = questions.find((item) => item.id === answer.questionId);
      return sum + (question?.points ?? 0);
    }, 0),
    manualMax: manual.reduce((sum, answer) => {
      const question = questions.find((item) => item.id === answer.questionId);
      return sum + (question?.points ?? 0);
    }, 0),
    maxPoints: questions.reduce((sum, question) => sum + question.points, 0),
    hasManualQuestion: manual.length > 0,
  };
}

export interface AttemptOutcome {
  status: 'graded' | 'pending_review';
  totalPoints: number | null;
  maxPoints: number;
  scorePercent: number | null;
  passed: boolean | null;
}

/** Combine automatic marks with (optional) manual marks into the final attempt. */
export function attemptOutcome(input: {
  autoPoints: number;
  manualPoints: number | null;
  maxPoints: number;
  passPercent: number;
}): AttemptOutcome {
  const pending = input.manualPoints === null;
  const total = input.autoPoints + (input.manualPoints ?? 0);
  const scorePercent = input.maxPoints > 0 ? Math.round((total / input.maxPoints) * 1000) / 10 : 0;

  return {
    status: pending ? 'pending_review' : 'graded',
    totalPoints: pending ? null : total,
    maxPoints: input.maxPoints,
    scorePercent: pending ? null : scorePercent,
    passed: pending ? null : scorePercent >= input.passPercent,
  };
}

export function parseSubmittedAnswers(formData: FormData, questions: QuizQuestion[]): SubmittedAnswer[] {
  return questions.map((question) => {
    if (question.type === 'single' || question.type === 'multiple') {
      const choices = formData
        .getAll(`q_${question.id}`)
        .map((value) => Number.parseInt(String(value), 10))
        .filter((value) => Number.isInteger(value));
      return { questionId: question.id, choices };
    }
    if (question.type === 'truefalse') {
      const raw = formData.get(`q_${question.id}`);
      return { questionId: question.id, choices: raw === null ? [] : [Number.parseInt(String(raw), 10)] };
    }
    return { questionId: question.id, text: String(formData.get(`q_${question.id}`) ?? '') };
  });
}
