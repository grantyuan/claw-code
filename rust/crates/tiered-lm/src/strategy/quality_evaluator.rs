#[derive(Debug, Clone)]
pub struct QualityMetrics {
    pub completeness: f32,
    pub coherence: f32,
    pub accuracy: f32,
    pub final_score: f32,
}

impl Default for QualityMetrics {
    fn default() -> Self {
        Self {
            completeness: 50.0,
            coherence: 50.0,
            accuracy: 50.0,
            final_score: 50.0,
        }
    }
}

pub trait QualityEvaluator: Send + Sync {
    fn evaluate(&self, response: &str, context: &str) -> QualityMetrics;
}

pub struct RuleBasedEvaluator;

impl RuleBasedEvaluator {
    pub fn new() -> Self {
        Self
    }

    pub fn evaluate(&self, response: &str, _context: &str) -> QualityMetrics {
        let completeness = self.evaluate_completeness(response);
        let coherence = self.evaluate_coherence(response);
        let accuracy = self.evaluate_accuracy(response);
        let final_score = completeness * 0.3 + coherence * 0.3 + accuracy * 0.4;

        QualityMetrics {
            completeness,
            coherence,
            accuracy,
            final_score,
        }
    }

    fn evaluate_completeness(&self, response: &str) -> f32 {
        let word_count = response.split_whitespace().count();
        let char_count = response.len();

        if word_count < 10 {
            30.0
        } else if word_count < 50 {
            60.0
        } else if char_count > 200 {
            85.0
        } else {
            70.0
        }
    }

    fn evaluate_coherence(&self, response: &str) -> f32 {
        let sentences: Vec<&str> = response
            .split(|c| c == '.' || c == '!' || c == '?')
            .filter(|s| !s.trim().is_empty())
            .collect();

        if sentences.len() <= 1 {
            50.0
        } else if sentences.len() <= 3 {
            70.0
        } else {
            85.0
        }
    }

    fn evaluate_accuracy(&self, response: &str) -> f32 {
        let has_ending_punctuation = response.trim().ends_with('.')
            || response.trim().ends_with('!')
            || response.trim().ends_with('?');

        if has_ending_punctuation {
            80.0
        } else {
            50.0
        }
    }
}

pub struct HybridQualityEvaluator {
    rule_engine: RuleBasedEvaluator,
}

impl HybridQualityEvaluator {
    pub fn new() -> Self {
        Self {
            rule_engine: RuleBasedEvaluator::new(),
        }
    }

    pub fn evaluate(&self, response: &str, context: &str) -> QualityMetrics {
        self.rule_engine.evaluate(response, context)
    }
}

impl QualityEvaluator for HybridQualityEvaluator {
    fn evaluate(&self, response: &str, context: &str) -> QualityMetrics {
        self.evaluate(response, context)
    }
}

impl QualityEvaluator for RuleBasedEvaluator {
    fn evaluate(&self, response: &str, context: &str) -> QualityMetrics {
        self.evaluate(response, context)
    }
}
