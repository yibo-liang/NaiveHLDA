/*
 * Copyright (C) 2007 by
 *
 * 	Xuan-Hieu Phan
 *	hieuxuan@ecei.tohoku.ac.jp or pxhieu@gmail.com
 * 	Graduate School of Information Sciences
 * 	Tohoku University
 *
 * GibbsLDA++ is a free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License,
 * or (at your option) any later version.
 *
 * GibbsLDA++ is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with GibbsLDA++; if not, write to the Free Software Foundation,
 * Inc., 59 Temple Place, Suite 330, Boston, MA 02111-1307 USA.
 */

 /*
  * References:
  * + The Java code of Gregor Heinrich (gregor@arbylon.net)
  *   http://www.arbylon.net/projects/LdaGibbsSampler.java
  * + "Parameter estimation for text analysis" by Gregor Heinrich
  *   http://www.arbylon.net/publications/text-est.pdf
  */

#include <stdlib.h>
#include <iostream>
#include <fstream>
#include <time.h>
#include <sstream>
#include <algorithm>
#include "constants.h"
#include "strtokenizer.h"
#include "utils.h"
#include "dataset.h"
#include "model.h"
#include "json.hpp"

using namespace std;

model::~model() {
	if (p) {
		delete p;
	}

	if (ptrndata) {
		delete ptrndata;
	}

	if (pnewdata) {
		delete pnewdata;
	}

	if (z) {
		for (int m = 0; m < M; m++) {
			if (z[m]) {
				delete z[m];
			}
		}
	}

	if (nw) {
		for (int w = 0; w < V; w++) {
			if (nw[w]) {
				delete nw[w];
			}
		}
	}

	if (nd) {
		for (int m = 0; m < M; m++) {
			if (nd[m]) {
				delete nd[m];
			}
		}
	}

	if (nwsum) {
		delete nwsum;
	}

	if (ndsum) {
		delete ndsum;
	}

	if (theta) {
		for (int m = 0; m < M; m++) {
			if (theta[m]) {
				delete theta[m];
			}
		}
	}

	if (phi) {
		for (int k = 0; k < K; k++) {
			if (phi[k]) {
				delete phi[k];
			}
		}
	}

	// only for inference
	if (newz) {
		for (int m = 0; m < newM; m++) {
			if (newz[m]) {
				delete newz[m];
			}
		}
	}

	if (newnw) {
		for (int w = 0; w < newV; w++) {
			if (newnw[w]) {
				delete newnw[w];
			}
		}
	}

	if (newnd) {
		for (int m = 0; m < newM; m++) {
			if (newnd[m]) {
				delete newnd[m];
			}
		}
	}

	if (newnwsum) {
		delete newnwsum;
	}

	if (newndsum) {
		delete newndsum;
	}

	if (newtheta) {
		for (int m = 0; m < newM; m++) {
			if (newtheta[m]) {
				delete newtheta[m];
			}
		}
	}

	if (newphi) {
		for (int k = 0; k < K; k++) {
			if (newphi[k]) {
				delete newphi[k];
			}
		}
	}
}

void model::set_default_values() {
	wordmapfile = "wordmap.txt";
	trainlogfile = "trainlog.txt";
	tassign_suffix = ".tassign";
	theta_suffix = ".theta";
	phi_suffix = ".phi";
	others_suffix = ".others";
	twords_suffix = ".twords";

	dir = "./";
	dfile = "trndocs.dat";
	model_name = "model-final";
	model_status = MODEL_STATUS_UNKNOWN;

	ptrndata = NULL;
	pnewdata = NULL;

	M = 0;
	V = 0;
	K = 100;
	alpha = 50.0 / K;
	beta = 0.1;
	niters = 2000;
	liter = 0;
	savestep = 2000;
	twords = 0;
	withrawstrs = 0;

	p = NULL;
	z = NULL;
	nw = NULL;
	nd = NULL;
	nwsum = NULL;
	ndsum = NULL;
	theta = NULL;
	phi = NULL;

	newM = 0;
	newV = 0;
	newz = NULL;
	newnw = NULL;
	newnd = NULL;
	newnwsum = NULL;
	newndsum = NULL;
	newtheta = NULL;
	newphi = NULL;
}

int model::parse_args(int argc, char ** argv) {
	return utils::parse_args(argc, argv, this);
}

int model::init(int argc, char ** argv) {
	// call parse_args
	if (parse_args(argc, argv)) {
		return 1;
	}

	if (model_status == MODEL_STATUS_EST) {
		// estimating the model from scratch
		if (init_est()) {
			return 1;
		}

	}
	else if (model_status == MODEL_STATUS_ESTC) {
		// estimating the model from a previously estimated one
		if (init_estc()) {
			return 1;
		}

	}
	else if (model_status == MODEL_STATUS_INF) {
		// do inference
		if (init_inf()) {
			return 1;
		}
	}
	else if (model_status == MODEL_STATUS_EST_H_INF) {
		// do inference
		if (init_esth()) {
			return 1;
		}
	}
	else if (model_status == MODEL_STATUS_EST_H_EST) {
		// estimating the model hierarchically with another existing model
		if (init_est()) {
			return 1;
		}
	}
	else if (model_status == MODEL_STATUS_EST_SH) {
		if (init_est_sh(this)) {
			return 1;
		}
	}

	return 0;
}

int model::load_model(string model_name) {
	int i, j;

	string filename = dir + model_name + tassign_suffix;
	FILE * fin = fopen(filename.c_str(), "r");
	if (!fin) {
		printf("Cannot open file %d to load model!\n", filename.c_str());
		return 1;
	}

	char buff[BUFF_SIZE_LONG];
	string line;

	// allocate memory for z and ptrndata
	z = new int*[M];
	ptrndata = new dataset(M);
	ptrndata->V = V;

	for (i = 0; i < M; i++) {
		char * pointer = fgets(buff, BUFF_SIZE_LONG, fin);
		if (!pointer) {
			printf("Invalid word-topic assignment file, check the number of docs!\n");
			return 1;
		}

		line = buff;
		strtokenizer strtok(line, " \t\r\n");
		int length = strtok.count_tokens();

		vector<int> words;
		vector<int> topics;
		for (j = 0; j < length; j++) {
			string token = strtok.token(j);

			strtokenizer tok(token, ":");
			if (tok.count_tokens() != 2) {
				printf("Invalid word-topic assignment line!\n");
				return 1;
			}

			words.push_back(atoi(tok.token(0).c_str()));
			topics.push_back(atoi(tok.token(1).c_str()));
		}

		// allocate and add new document to the corpus
		document * pdoc = new document(words);
		ptrndata->add_doc(pdoc, i);

		// assign values for z
		z[i] = new int[topics.size()];
		for (j = 0; j < topics.size(); j++) {
			z[i][j] = topics[j];
			if (z[i][j] < 0) throw exception("");
		}
	}

	fclose(fin);

	return 0;
}

int model::save_model(string model_name) {
	if (save_model_tassign(dir + model_name + tassign_suffix)) {
		return 1;
	}

	if (save_model_others(dir + model_name + others_suffix)) {
		return 1;
	}

	if (save_model_theta(dir + model_name + theta_suffix)) {
		return 1;
	}

	if (save_model_phi(dir + model_name + phi_suffix)) {
		return 1;
	}

	if (twords > 0) {
		if (save_model_twords(dir + model_name + twords_suffix)) {
			return 1;
		}
	}

	return 0;
}

int model::save_model_tassign(string filename) {
	int i, j;

	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	// wirte docs with topic assignments for words
	for (i = 0; i < ptrndata->M; i++) {
		for (j = 0; j < ptrndata->docs[i]->length; j++) {
			fprintf(fout, "%d:%d ", ptrndata->docs[i]->words[j], z[i][j]);
		}
		fprintf(fout, "\n");
	}

	fclose(fout);

	return 0;
}

int model::save_model_theta(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	for (int i = 0; i < M; i++) {
		for (int j = 0; j < K; j++) {
			fprintf(fout, "%f ", theta[i][j]);
		}
		fprintf(fout, "\n");
	}

	fclose(fout);

	return 0;
}

int model::save_model_phi(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	for (int i = 0; i < K; i++) {
		for (int j = 0; j < V; j++) {
			fprintf(fout, "%f ", phi[i][j]);
		}
		fprintf(fout, "\n");
	}

	fclose(fout);

	return 0;
}

int model::save_model_others(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	fprintf(fout, "alpha=%f\n", alpha);
	fprintf(fout, "beta=%f\n", beta);
	fprintf(fout, "ntopics=%d\n", K);
	fprintf(fout, "ndocs=%d\n", M);
	fprintf(fout, "nwords=%d\n", V);
	fprintf(fout, "liter=%d\n", liter);

	fclose(fout);

	return 0;
}

struct word_prob_order
{
	inline bool operator() (const pair<int, double>& a, const pair<int, double>& b)
	{
		return (a.second > b.second);
	}
};

int model::save_model_twords(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	if (twords > V) {
		twords = V;
	}
	mapid2word::iterator it;

	for (int k = 0; k < K; k++) {
		vector<pair<int, double> > words_probs;
		pair<int, double> word_prob;
		for (int w = 0; w < V; w++) {
			word_prob.first = w;
			word_prob.second = phi[k][w];
			words_probs.push_back(word_prob);
		}

		// quick sort to sort word-topic probability
		//utils::quicksort(words_probs, 0, words_probs.size() - 1);
		std::sort(words_probs.begin(), words_probs.end(), word_prob_order());

		fprintf(fout, "Topic %dth:\n", k);
		std::ostringstream strs;

		//for (int i = 0; i < this->est_depth; i++) {
		//	strs << " ";
		//}
		strs << "T" << k << ",";

		for (int i = 0; i < twords; i++) {

			it = id2word.find(words_probs[i].first);
			if (it != id2word.end()) {
				fprintf(fout, "\t%s   %f\n", (it->second).c_str(), words_probs[i].second);
			}
			int w = words_probs[i].first;

			strs << (it->second).c_str() << "|" << nw[w][k] << ",";


		}
		strs << endl;
		//string * str = new string();
		//*str= strs.str();
		this->tree[k] = strs.str();
	}

	fclose(fout);

	return 0;
}

int model::save_inf_model(string model_name) {
	if (save_inf_model_tassign(dir + model_name + tassign_suffix)) {
		return 1;
	}

	if (save_inf_model_others(dir + model_name + others_suffix)) {
		return 1;
	}

	if (save_inf_model_newtheta(dir + model_name + theta_suffix)) {
		return 1;
	}

	if (save_inf_model_newphi(dir + model_name + phi_suffix)) {
		return 1;
	}

	if (twords > 0) {
		if (save_inf_model_twords(dir + model_name + twords_suffix)) {
			return 1;
		}
	}

	return 0;
}

int model::save_inf_model_tassign(string filename) {
	int i, j;

	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	// wirte docs with topic assignments for words
	for (i = 0; i < pnewdata->M; i++) {
		for (j = 0; j < pnewdata->docs[i]->length; j++) {
			fprintf(fout, "%d:%d ", pnewdata->docs[i]->words[j], newz[i][j]);
		}
		fprintf(fout, "\n");
	}

	fclose(fout);

	return 0;
}

int model::save_inf_model_newtheta(string filename) {
	int i, j;

	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	for (i = 0; i < newM; i++) {
		for (j = 0; j < K; j++) {
			fprintf(fout, "%f ", newtheta[i][j]);
		}
		fprintf(fout, "\n");
	}

	fclose(fout);

	return 0;
}

int model::save_inf_model_newphi(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	for (int i = 0; i < K; i++) {
		for (int j = 0; j < newV; j++) {
			fprintf(fout, "%f ", newphi[i][j]);
		}
		fprintf(fout, "\n");
	}

	fclose(fout);

	return 0;
}

int model::save_inf_model_others(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	fprintf(fout, "alpha=%f\n", alpha);
	fprintf(fout, "beta=%f\n", beta);
	fprintf(fout, "ntopics=%d\n", K);
	fprintf(fout, "ndocs=%d\n", newM);
	fprintf(fout, "nwords=%d\n", newV);
	fprintf(fout, "liter=%d\n", inf_liter);

	fclose(fout);

	return 0;
}

int model::save_inf_model_twords(string filename) {
	FILE * fout = fopen(filename.c_str(), "w");
	if (!fout) {
		printf("Cannot open file %s to save!\n", filename.c_str());
		return 1;
	}

	if (twords > newV) {
		twords = newV;
	}
	mapid2word::iterator it;
	map<int, int>::iterator _it;

	for (int k = 0; k < K; k++) {
		vector<pair<int, double> > words_probs;
		pair<int, double> word_prob;
		for (int w = 0; w < newV; w++) {
			word_prob.first = w;
			word_prob.second = newphi[k][w];
			words_probs.push_back(word_prob);
		}

		// quick sort to sort word-topic probability
		utils::quicksort(words_probs, 0, words_probs.size() - 1);

		fprintf(fout, "Topic %dth:\n", k);
		for (int i = 0; i < twords; i++) {
			_it = pnewdata->_id2id.find(words_probs[i].first);
			if (_it == pnewdata->_id2id.end()) {
				continue;
			}
			it = id2word.find(_it->second);
			if (it != id2word.end()) {
				fprintf(fout, "\t%s   %f\n", (it->second).c_str(), words_probs[i].second);
			}
		}
	}

	fclose(fout);

	return 0;
}

int model::init_esth() {
	int i = init_inf();
	if (i == 1) throw exception("unable to init esth");
	theta = new double*[M];
	for (int m = 0; m < M; m++) {
		theta[m] = new double[K];
	}

	phi = new double*[K];
	for (int k = 0; k < K; k++) {
		phi[k] = new double[V];
	}
	compute_phi();
	compute_theta();
	//for (int i = 0; i < M; i++) {
	//	for (int j = 0; j < K; j++) {
	//		printf("%.3f ", theta[i][j]);
	//	}
	//	printf("\n");
	//}
	//calculate_sparse_hashmap();
	return i;
}

//
//int model::calculate_sparse_hashmap()
//{
//	//non_sparse_topic_doc_id.clear();
//	//non_sparse_topic_word_id.clear();
//
//	for (int i = 0; i < M; i++) {
//		for (int k = 0; k < K; k++) {
//			double _theta = theta[i][k];
//			if (_theta > 0.01) {
//				non_sparse_topic_doc_id[k][i]=_theta;
//				//cout << k << ", ";
//			}
//		}
//		//cout << endl;
//	}
//	//cout << "now phi" << endl;
//	for (int k = 0; k < K; k++) {
//		for (int v = 0; v < V; v++) {
//			if (phi[k][v]>0.001) {
//				non_sparse_topic_word_id[k][v]=phi[k][v];
//				//cout << v << ", ";
//			}
//		}
//		//cout << endl;
//	}
//
//	return 0;q
//}

//typedef Matrix<double, Dynamic, Dynamic> MatrixXdd;
//int model::map_eigen_matrix()
//{
//	MatrixXdd mt(K, M);
//	for (int m = 0; m < M; m++) {
//		for (int k = 0; k < K; k++) {
//			mt(k, m) = theta[m][k] > 0.001 ? theta[m][k] : 0;
//		}
//	}
//	this->mtheta = mt.sparseView();
//
//	MatrixXdd mp(K, V);
//	for (int k = 0; k < K; k++) {
//		for (int w = 0; w < V; w++) {
//			mp(k, w) = phi[k][w] > 0.001 ? phi[k][w] : 0;
//		}
//	}
//	this->mphi = mp.sparseView();
//	return 0;
//
//
//}


double threshold(double x, double th) {
	if (x >= th) return x;
	else return 0;
}
void model::sparsify()
{
	for (int k = 0; k < K; k++) {
		for (int m = 0; m < M; m++) {
			theta[m][k] = threshold(theta[m][k], 0.001);
		}
	}
	for (int w = 0; w < V; w++) {
		for (int k = 0; k < K; k++) {
			phi[k][w] = threshold(theta[k][w], 0.001);
		}
	}
}

int model::init_est() {
	int m, n, w, k;

	p = new double[K];

	// + read training data
	ptrndata = new dataset;
	if (ptrndata->read_trndata(dir + dfile, dir + wordmapfile)) {
		std::cout << dir << dfile << ", " << dir << wordmapfile << endl;
		printf("Fail to read training data!\n");
		return 1;
	}

	// + allocate memory and assign values for variables
	M = ptrndata->M;
	V = ptrndata->V;
	// K: from command line or default value
	// alpha, beta: from command line or default values
	// niters, savestep: from command line or default values

	nw = new int*[V];
	for (w = 0; w < V; w++) {
		nw[w] = new int[K];
		for (k = 0; k < K; k++) {
			nw[w][k] = 0;
		}
	}

	nd = new int*[M];
	for (m = 0; m < M; m++) {
		nd[m] = new int[K];
		for (k = 0; k < K; k++) {
			nd[m][k] = 0;
		}
	}

	nwsum = new int[K];
	for (k = 0; k < K; k++) {
		nwsum[k] = 0;
	}

	ndsum = new int[M];
	for (m = 0; m < M; m++) {
		ndsum[m] = 0;
	}

	srandom(time(0)); // initialize for random number generation
	z = new int*[M];
	for (m = 0; m < ptrndata->M; m++) {
		int N = ptrndata->docs[m]->length;
		z[m] = new int[N];

		// initialize for z
		for (n = 0; n < N; n++) {
			double r = (double)random() / (double)RAND_MAX;
			int topic = (int)((r * (double)(K - 1)));
			z[m][n] = topic;
			if (topic < 0) throw exception("OOOOOOOOOOOOOOOOOOOOOO");
			if (topic == K) throw exception("OOOOH");
			// number of instances of word i assigned to topic j
			nw[ptrndata->docs[m]->words[n]][topic] += 1;
			// number of words in document i assigned to topic j
			nd[m][topic] += 1;
			// total number of words assigned to topic j
			nwsum[topic] += 1;
		}
		// total number of words in document i
		ndsum[m] = N;
	}

	theta = new double*[M];
	for (m = 0; m < M; m++) {
		theta[m] = new double[K];
	}

	phi = new double*[K];
	for (k = 0; k < K; k++) {
		phi[k] = new double[V];
	}

	return 0;
}

int model::init_estc() {
	// estimating the model from a previously estimated one
	int m, n, w, k;

	p = new double[K];

	// load moel, i.e., read z and ptrndata
	if (load_model(model_name)) {
		printf("Fail to load word-topic assignmetn file of the model!\n");
		return 1;
	}

	nw = new int*[V];
	for (w = 0; w < V; w++) {
		nw[w] = new int[K];
		for (k = 0; k < K; k++) {
			nw[w][k] = 0;
		}
	}

	nd = new int*[M];
	for (m = 0; m < M; m++) {
		nd[m] = new int[K];
		for (k = 0; k < K; k++) {
			nd[m][k] = 0;
		}
	}

	nwsum = new int[K];
	for (k = 0; k < K; k++) {
		nwsum[k] = 0;
	}

	ndsum = new int[M];
	for (m = 0; m < M; m++) {
		ndsum[m] = 0;
	}

	for (m = 0; m < ptrndata->M; m++) {
		int N = ptrndata->docs[m]->length;

		// assign values for nw, nd, nwsum, and ndsum	
		for (n = 0; n < N; n++) {
			int w = ptrndata->docs[m]->words[n];
			int topic = z[m][n];

			// number of instances of word i assigned to topic j
			nw[w][topic] += 1;
			// number of words in document i assigned to topic j
			nd[m][topic] += 1;
			// total number of words assigned to topic j
			nwsum[topic] += 1;
		}
		// total number of words in document i
		ndsum[m] = N;
	}

	theta = new double*[M];
	for (m = 0; m < M; m++) {
		theta[m] = new double[K];
	}

	phi = new double*[K];
	for (k = 0; k < K; k++) {
		phi[k] = new double[V];
	}

	return 0;
}

double topic_word_cosine_similarity(int t1, int t2, model * model1, model * model2) {
	double sum_ab = 0;
	double sum_a2 = 0;
	double sum_b2 = 0;
	for (int i = 0; i < model1->V; i++) {
		double a_i = model1->phi[t1][i];
		double b_i = model2->phi[t2][i];
		sum_ab += a_i*b_i;
		sum_a2 += a_i*a_i;
		sum_b2 += b_i*b_i;
	}
	//cout << "sum ab=" << sum_ab << ", a2=" << sum_a2 << ", b2=" << sum_b2 << endl;
	return sum_ab / (sqrt(sum_a2)*sqrt(sum_b2));
}

double topic_document_cosine_similarity(int t1, int t2, model * est_model, model * inf_model) {
	double sum_ab = 0;
	double sum_a2 = 0;
	double sum_b2 = 0;
	for (int i = 0; i < est_model->M; i++) {
		double a_i = est_model->theta[i][t1];
		double b_i = inf_model->theta[i][t2];
		sum_ab += a_i*b_i;
		sum_a2 += a_i*a_i;
		sum_b2 += b_i*b_i;
	}
	return (double)sum_ab / (sqrt((double)sum_a2*(double)sum_b2));
}

double A_DOT_B_topic_doc(int t1, int t2, model * super_model, model * sub_model) {
	double sum_ab = 0;
	for (int i = 0; i < super_model->M; i++) {
		double a_i = super_model->theta[i][t1];
		double b_i = sub_model->theta[i][t2];
		sum_ab += a_i*b_i;
	}
	//cout << "A_DOT_B_topic_doc :" << sum_ab << "t1:" << t1 << "t2:" << t2 << endl;
	return sum_ab;
}

double A_DOT_B_topic_word(int t1, int t2, model * super_topic_model, model * sub_model) {
	double sum_ab = 0;
	for (int i = 0; i < super_topic_model->V; i++) {
		double a_i = super_topic_model->phi[t1][i];
		double b_i = sub_model->phi[t2][i];
		sum_ab += a_i*b_i;
	}
	//cout << "A_DOT_B_topic_word :" << sum_ab << "t1:" << t1 << "t2:" << t2 <<endl;
	return sum_ab;
}

double A2_topic_doc(int t1, model * model) {
	double sum = 0;
	for (int i = 0; i < model->M; i++) {
		double tmp = model->theta[i][t1];
		sum += tmp*tmp;
	}
	return sum;
}

double A2_topic_word(int t1, model * model) {
	double sum = 0;
	for (int i = 0; i < model->V; i++) {
		double tmp = model->phi[t1][i];
		sum += tmp*tmp;
	}
	return sum;
}

void print_mat(int d1, int d2, double** mat) {
	for (int i = 0; i < d1; i++) {
		for (int j = 0; j < d2; j++) {
			cout << mat[i][j] << " ";
		}
		cout << endl;
	}
}
void similarity_matrix(model * sub_model, model * super_topic_model, double* X, long double* Y, long  double** Z) {

	int K1 = super_topic_model->K;
	int K2 = sub_model->K;
	for (int k1 = 0; k1 < K1; k1++) {
		if (sub_model->compare_model == COMPARE_DOC_TOPIC) {
			X[k1] = A2_topic_doc(k1, super_topic_model);
		}
		else {
			X[k1] = A2_topic_word(k1, super_topic_model);
		}
		//cout << "x[k1]=" << X[k1] <<endl;
	}
	for (int k2 = 0; k2 < K2; k2++) {
		if (sub_model->compare_model == COMPARE_DOC_TOPIC) {
			Y[k2] = A2_topic_doc(k2, sub_model);
		}
		else {
			Y[k2] = A2_topic_word(k2, sub_model);
		}
		//cout << "Y[" << k2 << "]=" << Y[k2] << " ";

	}

	//cout << endl;
	//cout << sub_model->K << "," << super_topic_model->K << endl;
	for (int k_sub = 0; k_sub < K2; k_sub++) {
		for (int k_super = 0; k_super < K1; k_super++) {
			if (super_topic_model->compare_model == COMPARE_DOC_TOPIC) {
				Z[k_sub][k_super] = A_DOT_B_topic_doc(k_super, k_sub, super_topic_model, sub_model);
				//cout << Z[k_sub][k_super] << endl;
				//topic_document_cosine_similarity(k_super, k_sub, super_topic_model, sub_model);
			}
			else {
				Z[k_sub][k_super] = A_DOT_B_topic_word(k_super, k_sub, super_topic_model, sub_model);
				//cout << Z[k_sub][k_super] << endl;
				//topic_word_cosine_similarity(k_super, k_sub, super_topic_model, sub_model);

			}

		}
	}
	//print_mat(300, 30, Z);

}

void model::estimateH(model * _model) {
	if (twords > 0) {
		// print out top words per topic
		dataset::read_wordmap(dir + wordmapfile, &id2word);
	}
	cout << "N TOPIC=" << K << endl;
	compute_theta();
	compute_phi();
	//sparsify();
	//_model->sparsify();
	//prepare matrix for reference
	int K2 = _model->K;
	double* X = new double[K2];
	long double* Y = new  long double[K];
	long double** Z = new long double*[K];
	for (int i = 0; i < K; i++) {
		Z[i] = new long double[K2];
	}
	//compute similarity matrix between two model initially, and will be updated in sampling

	//print_mat(300, 30, Z);
	printf("Sampling %d iterations!\n", niters);
	clock_t t1, t2;
	t1 = clock();
	int last_iter = liter;
	int start = last_iter + 1;
	int end = niters + last_iter;
	for (liter = last_iter + 1; liter <= niters + last_iter; liter++) {
		printf("Iteration %d ...\n", liter);
		//map_eigen_matrix();
		//calculate_sparse_hashmap();
		// for all z_i

		similarity_matrix(this, _model, X, Y, Z);
		for (int m = 0; m < M; m++) {
			for (int n = 0; n < ptrndata->docs[m]->length; n++) {
				// (z_i = z[m][n])
				// sample from p(z_i|z_-i, w)
				//cout << "m=" << m << ", n=" << n << ", z[m][n]="<< z[m][n];
				int topic = samplingH(m, n, _model, X, Y, Z);
				//if (topic >= K || topic < 0) {
				//	throw exception();
				//}
				z[m][n] = topic;

				//std::cout << "(n/V)=" << n << "/" << ptrndata->docs[m]->length << std::endl;
			}


			//std::cout << "(m/M)=" << m<<"/"<<M << std::endl;
		}
		t2 = clock();
		int current = liter - start + 1;
		float diff = ((float)t2 - (float)t1) / (double)CLOCKS_PER_SEC;
		float remain = (float)(end - current)*diff / ((float)current);
		cout << "time past:" << diff << "sec, time remaining: " << remain << "sec" << endl;
		//
		if (savestep > 0) {
			if (liter % savestep == 0) {
				// saving the model
				printf("Saving the model at iteration %d ...\n", liter);
				compute_theta();
				compute_phi();
				std::ostringstream strs;
				strs << this->eta;
				std::string str = strs.str();
				save_model("H-ETA=" + str + "-" + utils::generate_model_name(liter));
			}
		}
	}

	for (int i = 0; i < K; i++) {
		delete[] Z[i];
	}
	delete[] X;
	delete[] Y;
	delete[] Z;

	printf("Gibbs sampling completed!\n");
	printf("Saving the final model!\n");

	liter--;
	std::ostringstream strs;
	strs << this->eta;
	std::string str = strs.str();
	save_model("H-ETA=" + str + "-" + utils::generate_model_name(-1));
}

void model::estimateSH(model * supermodel)
{
	if (twords > 0 && this == supermodel) {
		// print out top words per topic
		dataset::read_wordmap(dir + wordmapfile, &id2word);
	}

	//printf("Sampling %d iterations!\n", niters);

	int last_iter = liter;

	clock_t t1, t2;
	t1 = clock();

	for (liter = last_iter + 1; liter <= niters + last_iter; liter++) {
		//printf("Iteration %d ...\n", liter);
		cout << "\r Iteration:" << liter << " ";
		// for all z_i
		for (int m = 0; m < M; m++) {
			if (supermodel == this) {
				for (int n = 0; n < ptrndata->docs[m]->length; n++) {
					// (z_i = z[m][n])
					// sample from p(z_i|z_-i, w)
					int topic = sampling(m, n);
					z[m][n] = topic;
				}
			}
			else {
				for (int vi = 0; vi < this->V_subset_n[m]; vi++) {
					int n = V_subset[m][vi];
					int topic = sampling(m, n);
					z[m][n] = topic;
				}
			}

		}
	}
	cout << endl;
	printf("Gibbs sampling completed!\n");
	cout << "depth=" << this->est_depth << endl;
	//printf("Saving the final model!\n");
	compute_theta();
	compute_phi();
	liter--;
	std::ostringstream strs;
	strs << "" << this->K;
	std::string str = strs.str();
	//save_model("K=" + str + "-" + utils::generate_model_name(-1));

	if (this->est_depth + 1 == this->hDepth) {
		return;
	}
	//get subset of words in each document for each topic, run a topic model over the subset
	this->submodel_n = K;
	//this->submodels = (model**)malloc(sizeof(model*)*K);
	this->submodels = new model*[K];
	for (int k = 0; k < K; k++) {

		//create new subset
		//int * new_V_subset_n = (int*)malloc(sizeof(int)*M); //new sub docs
		//int ** new_V_subset = (int**)malloc(sizeof(int*)*M);

		int * new_V_subset_n = new int[M];
		int ** new_V_subset = new int*[M];
		for (int i = 0; i < M; i++) {
			//new_V_subset[i] = (int*)malloc(sizeof(int)*this->nd[i][k]);
			new_V_subset[i] = new int[this->nd[i][k]];

			new_V_subset_n[i] = 0;
			int i2 = 0;
			for (int n = 0; n < ptrndata->docs[i]->length; n++) {
				if (this->z[i][n] == k) {//for all word assigned topic k
					new_V_subset[i][i2] = n;
					new_V_subset_n[i]++;
					i2++;
				}
			}

		}
		//use new subset to sample sub topics
		cout << "Working on subset " << k << ", depth = " << est_depth << endl;
		this->submodels[k] = new model();
		this->submodels[k]->V_subset = new_V_subset;
		this->submodels[k]->V_subset_n = new_V_subset_n;
		this->submodels[k]->init_est_sh(this);
		this->submodels[k]->estimateSH(this);
		string temp = "";
		for (int i = 0; i < this->submodels[k]->K; i++) {
			temp += "T" + std::to_string(k) + "-" + this->submodels[k]->tree[i];
		}
		this->tree[k] += temp;

		//clear memory of subset


	}


	//if root
	if (supermodel == this) {
		cout << "All Finished";
		save_to_json_hierarchical_distinctive_level();
		save_to_json_hierarchical_nested();
		ofstream treefile;
		treefile.open("tree.txt");

		for (int k = 0; k < K; k++) {
			treefile << tree[k];
		}

		treefile.close();
	}

}

int model::samplingSH(int m, int n, model * supermodel)
{
	return 0;
}

vector<model*> model::get_submod_at_depth(int depth)
{
	if (this->est_depth == depth) {
		vector<model*> res;
		res.push_back(this);
		return res;
	}
	else if (this->est_depth < depth) {
		vector<model*> res;
		for (int k = 0; k < K; k++) {
			vector<model*> tmp = this->submodels[k]->get_submod_at_depth(depth);
			for (int i = 0; i < tmp.size(); i++) {
				res.push_back(tmp.at(i));
			}
		}
		return res;
	}

	return vector<model*>();
}


vector<vector<pair<string, int>>> get_topic_words(model& m) {


	mapid2word::iterator it;
	vector<vector<pair<string, int>>> res;
	for (int k = 0; k < m.K; k++) {
		vector<pair<int, double> > words_probs;
		pair<int, double> word_prob;
		for (int w = 0; w < m.V; w++) {
			word_prob.first = w;
			word_prob.second = m.phi[k][w];
			words_probs.push_back(word_prob);
		}

		// quick sort to sort word-topic probability
		//utils::quicksort(words_probs, 0, words_probs.size() - 1);
		std::sort(words_probs.begin(), words_probs.end(), word_prob_order());

		vector<pair<string, int>> word_freqs;
		for (int i = 0; i < m.twords; i++) {

			it = m.id2word.find(words_probs[i].first);

			string word = (it->second).c_str();
			int w = words_probs[i].first;
			int freq = m.nw[w][k];
			pair<string, int> word_freq;
			word_freq.first = word;
			word_freq.second = freq;
			word_freqs.push_back(word_freq);
		}
		res.push_back(word_freqs);
	}
	return res;
}


//topic similarity between topic a and b in model m
double cosine_similarity(model* m1, int ma, model* m2, int mb, int* root_ndsum) {
	int M = m1->M;
	double sum_ab = 0;
	double sum_a2 = 0;
	double sum_b2 = 0;
	for (int i = 0; i < M; i++) {

		//recalculate theta value based on root ndsum.
		double da = ((double)m1->nd[i][ma] + m1->alpha) / ((double)root_ndsum[i] + m1->alpha);
		double db = ((double)m2->nd[i][mb] + m2->alpha) / ((double)root_ndsum[i] + m2->alpha);

		if (m1->nd[i][ma] < 0) {
			throw new exception();
		}

		sum_ab += da*db;
		sum_a2 += da*da;
		sum_b2 += db*db;
	}
	double result = sum_ab / (sqrt(sum_a2)*sqrt(sum_b2));
	if (result < 0) {
		cout << result << endl;
	}
	return result;
}

int model::save_to_json_hierarchical_distinctive_level()
{
	//ONLY USED BY ROOT TOPIC MODEL OBJECT

	cout << "Saving to JSON" << endl;
	using json = nlohmann::json;
	json obj;

	mapid2word::iterator it;

	vector<vector<model*>> collection;

	int ntopics = 1;
	for (int l = 0; l < hDepth; l++) {
		//collect all model at the depth

		vector<model*> models_at_d = this->get_submod_at_depth(l);
		ntopics *= models_at_d[0]->K;

		json merge_topic_model;
		json topics;
		json topicsSimilarities;

		json topicClassesDistrib;

		json metadata;
		metadata["nDocs"] = M;
		metadata["docClasses"] = { "EU","UK" };
		metadata["nTopics"] = ntopics;

		int temp_i = 0;
		for (int lk = 0; lk < models_at_d.size(); lk++) {

			//collect word frequency(weight) for each topic at this depth level
			model* m = models_at_d[lk];
			//vector<vector<pair<int, double>>> topics_words = get_topic_words(*m);

			vector<vector<pair<string, int>>> word_freqs = get_topic_words(*m);
			for (int i = 0; i < word_freqs.size(); i++) { //for each topics in model m
				//vector<pair<int, double>> topic_words = topics_words[i];
				vector<pair<string, int>> word_freq = word_freqs[i];
				json topic_word_list;
				for (int w = 0; w < word_freq.size(); w++) {

					json ins = { { "label", word_freq[w].first },{ "weight", word_freq[w].second} };
					topic_word_list.push_back(ins);
				}

				/*
				for (int w = 0; w < twords; w++) {
					it = id2word.find(topic_words[w].first);
					int topic_i = lk % Kn[l];

					string word = (it->second).c_str();

					int freq = models_at_d[l]->nw[topic_words[w].first][topic_i];

					json ins = { {"label", word}, {"weight", freq} };
					topic_word_list.push_back(ins);
				}*/

				string tmp = std::to_string(temp_i);
				topics[tmp] = (topic_word_list);
				temp_i++;
			}

			//similarity matrix
			for (int k1 = 0; k1 < m->K; k1++) {
				int ma = k1 + lk*m->K;
				for (int lk2 = 0; lk2 < models_at_d.size(); lk2++) {
					model* m2 = models_at_d[lk2];
					for (int k2 = 0; k2 < m2->K; k2++) {
						int mb = k2 + lk2*m2->K;
						double sim = cosine_similarity(m, k1, m2, k2, ndsum);
						string sma = std::to_string(ma);
						string smb = std::to_string(mb);
						topicsSimilarities[sma][smb] = sim;
					}

				}
			}

		}
		merge_topic_model["topics"] = topics;
		merge_topic_model["topicsSimilarities"] = topicsSimilarities;
		merge_topic_model["metadata"] = metadata;


		json topicDocDistribution;

		double weight_sum_all = 0;
		double value_sum_all = 0;

		for (int k = 0; k < models_at_d.size(); k++) {
			model* mod = models_at_d[k];
			for (int i = 0; i < mod->K; i++) {
				int rk = i + mod->K*k;

				//for topic doc 
				json topic_doc_dist;


				//for topic classes (EU/UK)
				json class_eu;
				json class_uk;

				class_eu["classID"] = "EU";
				class_uk["classID"] = "UK";

				double weight_sum_uk = 0;
				double weight_sum_eu = 0;

				double weight_value_sum_norm_uk = 0;
				double weight_value_sum_norm_eu = 0;

				double weight_value_sum_uk = 0;
				double weight_value_sum_eu = 0;

				double weight_sum_norm_uk = 0;
				double weight_sum_norm_eu = 0;


				double avr_weight = 0;
				for (int m = 0; m < M; m++) {
					double tweight;
					if (mod->nd[m][i] == 0) {
						tweight = 0;
					}
					else {
						tweight = (double)mod->nd[m][i] / (double)mod->ndsum[m];
					}
					avr_weight += tweight / (double)M;
				}

				for (int m = 0; m < M; m++) {
					string topic_id = to_string(m);
					double tweight;
					if (mod->nd[m][i] == 0) {
						tweight = 0;
					}
					else {
						tweight = (double)mod->nd[m][i] / (double)mod->ndsum[m]; //mod->theta[m][i];
						//cout << "word n in doc " << m << " is " << mod->ndsum[m]<<endl;
					}
					json tmp;

					if (mod->ptrndata->docs[m]->grant_type != "UK") {
						weight_sum_eu += tweight;
						double val = mod->ptrndata->docs[m]->fund_value;
						weight_value_sum_eu += tweight*val;

					}
					else {
						weight_sum_uk += tweight;
						double val = mod->ptrndata->docs[m]->fund_value;
						weight_value_sum_uk += tweight* val;
					}


					if (tweight < avr_weight) continue;
					tmp["topicWeight"] = tweight;
					tmp["docId"] = to_string(m);
					topic_doc_dist.push_back(tmp);
				}

				class_eu["weightSum"] = weight_sum_eu;
				class_eu["weightedValueSum"] = weight_value_sum_eu;
				class_uk["weightSum"] = weight_sum_uk;
				class_uk["weightedValueSum"] = weight_value_sum_uk;


				weight_sum_all += (weight_sum_eu + weight_sum_uk);
				value_sum_all += (weight_value_sum_eu + weight_value_sum_uk);


				topicClassesDistrib[to_string(rk)] = { class_eu, class_uk };
				topicDocDistribution[to_string(rk)] = topic_doc_dist;
			}
		}

		for (int k = 0; k < models_at_d.size(); k++) {
			model* mod = models_at_d[k];
			for (int i = 0; i < mod->K; i++) {
				int rk = i + mod->K*k;
				topicClassesDistrib[to_string(rk)][0]["weightSumNorm"] = topicClassesDistrib[to_string(rk)][0]["weightSum"] / weight_sum_all;
				topicClassesDistrib[to_string(rk)][1]["weightSumNorm"] = topicClassesDistrib[to_string(rk)][1]["weightSum"] / weight_sum_all;

				topicClassesDistrib[to_string(rk)][0]["weightedValueSumNorm"] = topicClassesDistrib[to_string(rk)][0]["weightedValueSum"] / value_sum_all;
				topicClassesDistrib[to_string(rk)][1]["weightedValueSumNorm"] = topicClassesDistrib[to_string(rk)][1]["weightedValueSum"] / value_sum_all;
			}
		}
		merge_topic_model["topicsDocsDistrib"] = topicDocDistribution;
		merge_topic_model["topicsClassesDistrib"] = topicClassesDistrib;

		std::ofstream file(dir + "K" + to_string(models_at_d.size()) + "_d" + to_string(l) + ".json");
		string dump = merge_topic_model.dump();
		file << dump;
		file.close();
	}
	//compare similarity between different depth

	for (int d = 0; d < hDepth - 1; d++) {
		int d2 = d + 1;
		json sim_ds;
		vector<model*> models_at_d = this->get_submod_at_depth(d);
		vector<model*> models_at_d2 = this->get_submod_at_depth(d2);
		for (int m1 = 0; m1 < models_at_d.size(); m1++) {
			model* mod1 = models_at_d[m1];
			for (int k1 = 0; k1 < mod1->K; k1++) {

				//inner loop for next depth level
				for (int m2 = 0; m2 < models_at_d2.size(); m2++) {
					model* mod2 = models_at_d2[m2];
					for (int k2 = 0; k2 < mod2->K; k2++) {
						double sim = cosine_similarity(mod1, k1, mod2, k2, this->ndsum);
						string rk1 = to_string(k1 + m1*mod1->K);
						string rk2 = to_string(k2 + m2*mod2->K);
						sim_ds[rk1][rk2] = sim;
					}

				}

			}

		}
		std::ofstream file(dir + "compare_" + to_string(d) + "_" + to_string(d2) + ".json");
		string dump = sim_ds.dump();
		file << dump;
		file.close();
	}
	//topic doc distribution


	return 0;
}

using json = nlohmann::json;

json _save_to_json_hierarchical_nested(model * mod, model* top_mod) {
	json model;

	json topics;
	json topicsSimilarities;
	json topicClassesDistrib;
	json metadata;
	json topicDocDistribution;

	{ //turning single model/submodel to json file
		metadata["nDocs"] = mod->M;
		metadata["nTopics"] = mod->K;
		metadata["nWordsPerTopic"] = mod->twords;
		metadata["docClasses"] = { "EU", "UK" };
		metadata["subTopicNumber"] = mod->submodel_n;


		vector<vector<pair<string, int>>> word_freqs = get_topic_words(*mod);
		for (int i = 0; i < word_freqs.size(); i++) {
			vector<pair<string, int>> word_freq = word_freqs[i];
			json topic_word_list;
			for (int w = 0; w < word_freq.size(); w++) {

				json ins = { { "label", word_freq[w].first },{ "weight", word_freq[w].second } };
				topic_word_list.push_back(ins);
			}

			string tmp = std::to_string(i);
			topics[tmp] = (topic_word_list);
		}

		//similarity matrix
		for (int k1 = 0; k1 < mod->K; k1++) {
			for (int k2 = 0; k2 < mod->K; k2++) {
				double sim = cosine_similarity(mod, k1, mod, k2, top_mod->ndsum);
				string sma = std::to_string(k1);
				string smb = std::to_string(k2);
				topicsSimilarities[sma][smb] = sim;
			}
		}




		vector<double> weight_sum_eu_vec;
		vector<double> weight_sum_uk_vec;

		vector<double> value_sum_eu_vec;
		vector<double> value_sum_uk_vec;


		double weight_sum_all = 0;
		double value_sum_all = 0;

		for (int i = 0; i < mod->K; i++) {

			//for topic doc 
			json topic_doc_dist;


			//for topic classes (EU/UK)
			json class_eu;
			json class_uk;

			class_eu["classID"] = "EU";
			class_uk["classID"] = "UK";

			double weight_sum_uk = 0;
			double weight_sum_eu = 0;

			double weight_value_sum_uk = 0;
			double weight_value_sum_eu = 0;

			double avr_weight = 0;
			for (int m = 0; m < mod->M; m++) {
				double tweight;
				if (mod->nd[m][i] == 0) {
					tweight = 0;
				}
				else {
					tweight = (double)mod->nd[m][i] / (double)top_mod->ndsum[m];
				}
				avr_weight += tweight / (double)top_mod->M;
			}

			for (int m = 0; m < mod->M; m++) {
				string topic_id = to_string(m);
				double tweight = (double)mod->nd[m][i] / (double)top_mod->ndsum[m]; //mod->theta[m][i];
				json tmp;

				if (mod->ptrndata->docs[m]->grant_type != "UK") {
					weight_sum_eu += tweight;
					double val = mod->ptrndata->docs[m]->fund_value;
					weight_value_sum_eu += tweight*val;

				}
				else {
					weight_sum_uk += tweight;
					double val = mod->ptrndata->docs[m]->fund_value;
					weight_value_sum_uk += tweight* val;
				}


				if (tweight < avr_weight) continue;
				tmp["topicWeight"] = tweight;
				tmp["docId"] = mod->ptrndata->docs[m]->doc_id;
				tmp["docClass"] = mod->ptrndata->docs[m]->grant_type;
				topic_doc_dist.push_back(tmp);
			}

			class_eu["weightSum"] = weight_sum_eu;
			class_eu["weightedValueSum"] = weight_value_sum_eu;
			class_uk["weightSum"] = weight_sum_uk;
			class_uk["weightedValueSum"] = weight_value_sum_uk;


			weight_sum_eu_vec.push_back(weight_sum_eu);
			weight_sum_uk_vec.push_back(weight_sum_uk);

			value_sum_eu_vec.push_back(weight_value_sum_eu);
			value_sum_uk_vec.push_back(weight_value_sum_uk);


			weight_sum_all += (weight_sum_eu + weight_sum_uk);
			value_sum_all += (weight_value_sum_eu + weight_value_sum_uk);


			topicClassesDistrib[to_string(i)] = { class_eu, class_uk };
			topicDocDistribution[to_string(i)] = topic_doc_dist;
		}

		cout << "-----------------------" << endl;
		for (int k = 0; k < mod->K; k++) {
			topicClassesDistrib[to_string(k)][0]["weightSumNorm"] = weight_sum_eu_vec[k] / weight_sum_all;
			topicClassesDistrib[to_string(k)][1]["weightSumNorm"] = weight_sum_uk_vec[k] / weight_sum_all;

			cout << value_sum_eu_vec[k] << "/ " << value_sum_all << "=" << value_sum_eu_vec[k] / value_sum_all <<endl;

			topicClassesDistrib[to_string(k)][0]["weightedValueSumNorm"] = value_sum_eu_vec[k] / value_sum_all;
			topicClassesDistrib[to_string(k)][1]["weightedValueSumNorm"] = value_sum_uk_vec[k] / value_sum_all;
		}


		metadata["weightSumAll"] = weight_sum_all;
		metadata["valueSumAll"] = value_sum_all;

	}


	json submodels;
	for (int i = 0; i < mod->submodel_n; i++) {
		json submodel = _save_to_json_hierarchical_nested(mod->submodels[i], top_mod);
		submodels.push_back(submodel);
	}
	model["metadata"] = metadata;
	model["topicsSimilarities"] = topicsSimilarities;
	model["topicsDocsDistrib"] = topicDocDistribution;
	model["topicClassesDistrib"] = topicClassesDistrib;
	model["topics"] = topics;
	model["submodels"] = submodels;

	return model;
}

int model::save_to_json_hierarchical_nested()
{

	json all_mod = _save_to_json_hierarchical_nested(this, this);
	std::ofstream file(dir + "topic_model_hierarchical.json");
	string dump = all_mod.dump();
	file << dump;
	file.close();
	return 0;
}

void model::estimate() {
	if (twords > 0) {
		// print out top words per topic
		dataset::read_wordmap(dir + wordmapfile, &id2word);
	}

	printf("Sampling %d iterations!\n", niters);

	int last_iter = liter;
	for (liter = last_iter + 1; liter <= niters + last_iter; liter++) {
		printf("Iteration %d ...\n", liter);

		// for all z_i
		for (int m = 0; m < M; m++) {
			for (int n = 0; n < ptrndata->docs[m]->length; n++) {
				// (z_i = z[m][n])
				// sample from p(z_i|z_-i, w)
				int topic = sampling(m, n);
				z[m][n] = topic;
			}
		}

		if (savestep > 0) {
			if (liter % savestep == 0) {
				// saving the model
				printf("Saving the model at iteration %d ...\n", liter);
				compute_theta();
				compute_phi();
				save_model(utils::generate_model_name(liter));
			}
		}
	}

	printf("Gibbs sampling completed!\n");
	printf("Saving the final model!\n");
	compute_theta();
	compute_phi();
	liter--;
	std::ostringstream strs;
	strs << this->K;
	std::string str = strs.str();
	save_model("K=" + str + "-" + utils::generate_model_name(-1));
}

double topic_word_euclidean_distance(int t1, int t2, model* model1, model* model2) {
	return 0;
}

//
//double topic_word_cosine_similarity3(int t1, int t2, model * model1, model * model2) {
//	VectorXd a = model1->mphi.row(t1);
//	VectorXd b = model2->mphi.row(t2);
//	double result = a.dot(b) / sqrt(a.dot(a)*b.dot(b));
//	//cout << result <<","<< topic_word_cosine_similarity2(t1,t2,model1,model2) <<endl;
//	return result;
//}
//
//double topic_document_cosine_similarity3(int t1, int t2, model * est_model, model * inf_model) {
//	VectorXd a = est_model->mtheta.row(t1);
//	VectorXd b = inf_model->mtheta.row(t2);
//	double result = a.dot(b) / sqrt(a.dot(a)*b.dot(b));
//	//cout << result <<"," << topic_document_cosine_similarity2(t1,t2,est_model, inf_model)<< endl;
//	return result;
//}
//

void updateYZ(int sub_topic_id, int super_topic_id, int w, int m, model * sub_model, model * super_topic_model, long double*Y, long double** Z) {

	double old_phi = sub_model->phi[sub_topic_id][w];
	double old_theta = sub_model->theta[m][sub_topic_id];
	double new_phi = sub_model->update_phi(sub_topic_id, w);
	double new_theta = sub_model->update_theta(sub_topic_id, m);
	//cout << "topic:" << topic << ", extern_topic:" << extern_topic << ", w:" << w << ", m:" << m <<endl;
	//cout << old_phi << "," << old_theta << "," << new_phi << "," << new_theta << "-";
	//X is always the same
	//Y is updated everytime a word is being sampled, and therefore Z as well

	double old_val = 0;
	double new_val = 0;
	double p2;
	if (sub_model->compare_model == COMPARE_DOC_TOPIC) {
		old_val = old_theta;
		new_val = new_theta;
		p2 = super_topic_model->theta[m][super_topic_id];
	}
	else {
		old_val = old_phi;
		new_val = new_phi;
		p2 = super_topic_model->phi[super_topic_id][w];
	}
	//double tmp = Y[sub_topic_id];
	Y[sub_topic_id] = (Y[sub_topic_id] - old_val*old_val + new_val*new_val);

	//long double tmp2 = Z[sub_topic_id][super_topic_id];
	Z[sub_topic_id][super_topic_id] = (Z[sub_topic_id][super_topic_id] - (old_val - new_val)*p2);
	/*if (old_val < 0 || new_val < 0 || p2 < 0) {
		cout << "wrong" << endl;
	}
	if (Z[sub_topic_id][super_topic_id] < 0) {
		cout << "tmp2=" << tmp2 << " " << endl;
		topic_word_cosine_similarity(sub_topic_id, super_topic_id, sub_model, super_topic_model);
		cout << "Z[sub_topic_id][super_topic_id]=" << Z[sub_topic_id][super_topic_id] << endl;

	}
	if (Y[sub_topic_id] != Y[sub_topic_id]) {
		cout << Y[sub_topic_id] << endl;
	}*/
	//print_mat(300,30,Z);
}

int model::samplingH(int m, int n, model * super_topic_model, double* X, long double* Y, long double** XDOTY) {
	/*
	let X= sigma(A^2)
	let Y= sigma(B^2)
	let Z= sigma(A dot B)
	then similarity matrix by cosine similarity is
	Z/sqrt(XY)
*/

// remove z_i from the count variables
	int sub_topic = this->z[m][n];
	int super_topic = super_topic_model->z[m][n]; //the topic that this specific word instance n in doc m is assigned to
	if (sub_topic == this->K || super_topic == super_topic_model->K)
		//throw exception("NOOOOO!");
		cout << this->K << endl;
	//cout <<", pdw=" << ptrndata->docs[m]->words[n] << endl;
	int w = ptrndata->docs[m]->words[n];
	nw[w][sub_topic] -= 1;
	nd[m][sub_topic] -= 1;
	nwsum[sub_topic] -= 1;
	ndsum[m] -= 1;


	updateYZ(sub_topic, super_topic, w, m, this, super_topic_model, Y, XDOTY);

	double Vbeta = V * beta;
	double Kalpha = K * alpha;
	// do multinomial sampling via cumulative method

	double sumx = 0;
	//#pragma omp parallel for reduction(+:sumx)
	for (int k2 = 0; k2 < K; k2++) {
		sumx += XDOTY[k2][super_topic] / sqrt(X[super_topic]) / sqrt(Y[k2]); //  Z/sqrt(XY)
	}

	//#pragma omp parallel for 
	for (int k = 0; k < K; k++) {
		double x = XDOTY[k][super_topic] / sqrt(X[super_topic]) / sqrt(Y[k]); //  Z/sqrt(XY)



		//double x = topic_word_cosine_similarity(k, super_topic, this, super_topic_model);
		x = (x + eta) / (sumx + eta);
		/*
		if (x != x2) {
			cout << "k:" << k << ", x: " << x << " sqrt(X[topic_extern] * Y[k]):" << sqrt(X[super_topic] * Y[k]) << " Z[topic][SUPER]:" << XDOTY[sub_topic][super_topic] << endl;
			cout << "sub:" << sub_topic << ", super:" << super_topic << endl;
			cout << "X[super_topic]" << X[super_topic] << ", Y[k]" << Y[k] << endl;
			cout << "x2:=" << x2 << endl;
		}*/
		/*if (x != x || x < 0) {
			double sim;
			if (this->compare_model == COMPARE_DOC_TOPIC) {
				sim = topic_document_cosine_similarity(k, super_topic, this, super_topic_model);
			}


			else {
				sim = topic_word_cosine_similarity(k, super_topic, this, super_topic_model);
			}
			cout << "k:" << k << ", x: " << x << " sqrt(X[topic_extern] * Y[k]):" << sqrt(X[super_topic] * Y[k]) << " Z[topic][SUPER]:" << XDOTY[sub_topic][super_topic] << endl;
			cout << "sub:" << sub_topic << ", super:" << super_topic << endl;
			cout << "X[super_topic]" << X[super_topic] << ", Y[k]" << Y[k] << endl;
			cout << "sim:=" << sim << endl;
		}*/
		p[k] = (nw[w][k] + beta) / (nwsum[k] + Vbeta) *
			(nd[m][k] + alpha) / (ndsum[m] + Kalpha) * x;
		/*(this->compare_model == COMPARE_DOC_TOPIC
			? topic_document_cosine_similarity(k, topic_extern, this, _model)
			: topic_word_cosine_similarity(k, topic_extern, this, _model))*/
			//cout << "p[" << k << "]=" << p[k]<< endl;

	}
	// cumulate multinomial parameters
	for (int k = 1; k < K; k++) {
		p[k] += p[k - 1];
		if (p[k] < 0)
			cout << "p[" << k << "]=" << p[k] << endl;
	}
	// scaled sample because of unnormalized p[]
	double u = ((double)random() / (double)RAND_MAX) * p[K - 1];
	//cout << " p[K - 1]=" << p[K - 1] << ", u:" << u << endl;
	int new_sub_topic;
	for (new_sub_topic = 0; new_sub_topic < K; new_sub_topic++) {
		if (p[new_sub_topic] >= u) {
			break;
		}
	}
	if (new_sub_topic >= K)
		throw exception("Should not be K");
	//cout << "m=" << m << ", n=" << n << ", new topic=" << topic << endl;
	/*if (u != u)
		cout << "m=" << m << ", n=" << n << ", new topic=" << new_sub_topic << endl;*/
		// add newly estimated z_i to count variables
	nw[w][new_sub_topic] += 1;
	nd[m][new_sub_topic] += 1;
	nwsum[new_sub_topic] += 1;
	ndsum[m] += 1;


	updateYZ(new_sub_topic, super_topic, w, m, this, super_topic_model, Y, XDOTY);

	return new_sub_topic;
}

int model::init_est_sh(model * supermodel)
{

	this->tree = new string[K];
	this->twords = supermodel->twords;
	this->model_name = supermodel->model_name;
	this->model_status = supermodel->model_status;
	int m, n, w, k;
	this->hDepth = supermodel->hDepth;
	this->Kn = supermodel->Kn;
	this->niters = supermodel->niters;
	this->id2word = supermodel->id2word;

	this->dir = supermodel->dir;

	// + read training data
	if (supermodel == this) {
		init_est();
		est_depth = 0;
		this->K = Kn[est_depth];
		return 0;

		/*
		p = new double[K];

		ptrndata = new dataset;
		if (ptrndata->read_trndata(dir + dfile, dir + wordmapfile)) {
			std::cout << dir << dfile << ", " << dir << wordmapfile << endl;
			printf("Fail to read training data!\n");
			return 1;
		}
		M = ptrndata->M;
		V = ptrndata->V;*/
	}
	else {
		//load subset data from super model
		est_depth = supermodel->est_depth + 1;
		this->K = Kn[est_depth];
		p = new double[K];
		ptrndata = supermodel->ptrndata;
		M = ptrndata->M;
		V = ptrndata->V;
	}

	this->alpha = supermodel->alpha;
	this->beta = supermodel->beta;


	// + allocate memory and assign values for variables

	// K: from command line or default value
	// alpha, beta: from command line or default values
	// niters, savestep: from command line or default values

	nw = new int*[V];
	for (w = 0; w < V; w++) {
		nw[w] = new int[K];
		for (k = 0; k < K; k++) {
			nw[w][k] = 0;
		}
	}

	nd = new int*[M];
	for (m = 0; m < M; m++) {
		nd[m] = new int[K];
		for (k = 0; k < K; k++) {
			nd[m][k] = 0;
		}
	}

	nwsum = new int[K];
	for (k = 0; k < K; k++) {
		nwsum[k] = 0;
	}

	ndsum = new int[M];
	for (m = 0; m < M; m++) {
		ndsum[m] = 0;
	}

	srandom(time(0)); // initialize for random number generation
	z = new int*[M];
	for (m = 0; m < ptrndata->M; m++) {
		int N = ptrndata->docs[m]->length;
		z[m] = new int[N];
		//cout <<" this->V_subset_n[m] : " << this->V_subset_n[m] << endl;

		for (int vi = 0; vi < this->V_subset_n[m]; vi++) {
			int n = V_subset[m][vi];
			double r = (double)random() / (double)RAND_MAX;
			int topic = (int)((r * (double)(K - 1)));
			z[m][n] = topic;
			// number of instances of word i assigned to topic j
			nw[ptrndata->docs[m]->words[n]][topic] += 1;
			// number of words in document i assigned to topic j
			nd[m][topic] += 1;
			// total number of words assigned to topic j
			nwsum[topic] += 1;
		}
		// total number of words in document i
		ndsum[m] = this->V_subset_n[m];
	}

	theta = new double*[M];
	for (m = 0; m < M; m++) {
		theta[m] = new double[K];
	}

	phi = new double*[K];
	for (k = 0; k < K; k++) {
		phi[k] = new double[V];
	}

	return 0;
}

int model::sampling(int m, int n) {
	// remove z_i from the count variables
	int topic = z[m][n];
	int w = ptrndata->docs[m]->words[n];
	nw[w][topic] -= 1;
	nd[m][topic] -= 1;
	nwsum[topic] -= 1;
	ndsum[m] -= 1;

	double Vbeta = V * beta;
	double Kalpha = K * alpha;
	// do multinomial sampling via cumulative method
	double s;
	for (int k = 0; k < K; k++) {
		s = (nw[w][k] + beta) / (nwsum[k] + Vbeta) *
			(nd[m][k] + alpha) / (ndsum[m] + Kalpha);
		p[k] = s;
	}
	// cumulate multinomial parameters
	for (int k = 1; k < K; k++) {
		p[k] += p[k - 1];
	}
	// scaled sample because of unnormalized p[]
	double u = ((double)random() / (double)RAND_MAX) * p[K - 1];

	for (topic = 0; topic < K; topic++) {
		if (p[topic] >= u) {
			break;
		}
	}
	if (topic >= K)
		throw exception("KKKKK");

	// add newly estimated z_i to count variables
	nw[w][topic] += 1;
	nd[m][topic] += 1;
	nwsum[topic] += 1;
	ndsum[m] += 1;

	return topic;
}

double model::update_theta(int k, int m) { //k=topic id, m = doc id

	theta[m][k] = (nd[m][k] + alpha) / (ndsum[m] + K * alpha);
	return theta[m][k];
}

double model::update_phi(int k, int w) { //k = topic id, w=word id

	phi[k][w] = (nw[w][k] + beta) / (nwsum[k] + V * beta);
	return phi[k][w];
}

void model::compute_theta() {
	for (int m = 0; m < M; m++) {
		for (int k = 0; k < K; k++) {
			theta[m][k] = threshold((nd[m][k] + alpha) / (ndsum[m] + K * alpha), 0.00);
		}
	}
}

void model::compute_phi() {
	for (int k = 0; k < K; k++) {
		for (int w = 0; w < V; w++) {
			phi[k][w] = threshold((nw[w][k] + beta) / (nwsum[k] + V * beta), 0.00);
		}
	}
}

int model::init_inf() {
	// estimating the model from a previously estimated one
	int m, n, w, k;

	p = new double[K];

	// load moel, i.e., read z and ptrndata
	if (load_model(model_name)) {
		printf("Fail to load word-topic assignmetn file of the model!\n");
		return 1;
	}

	nw = new int*[V];
	for (w = 0; w < V; w++) {
		nw[w] = new int[K];
		for (k = 0; k < K; k++) {
			nw[w][k] = 0;
		}
	}

	nd = new int*[M];
	for (m = 0; m < M; m++) {
		nd[m] = new int[K];
		for (k = 0; k < K; k++) {
			nd[m][k] = 0;
		}
	}

	nwsum = new int[K];
	for (k = 0; k < K; k++) {
		nwsum[k] = 0;
	}

	ndsum = new int[M];
	for (m = 0; m < M; m++) {
		ndsum[m] = 0;
	}

	for (m = 0; m < ptrndata->M; m++) {
		int N = ptrndata->docs[m]->length;

		// assign values for nw, nd, nwsum, and ndsum	
		for (n = 0; n < N; n++) {
			int w = ptrndata->docs[m]->words[n];
			int topic = z[m][n];

			// number of instances of word i assigned to topic j
			nw[w][topic] += 1;
			// number of words in document i assigned to topic j
			nd[m][topic] += 1;
			// total number of words assigned to topic j
			nwsum[topic] += 1;
		}
		// total number of words in document i
		ndsum[m] = N;
	}

	// read new data for inference
	pnewdata = new dataset;
	if (withrawstrs) {
		if (pnewdata->read_newdata_withrawstrs(dir + dfile, dir + wordmapfile)) {
			printf("Fail to read new data!\n");
			return 1;
		}
	}
	else {
		if (pnewdata->read_newdata(dir + dfile, dir + wordmapfile)) {
			printf("Fail to read new data!\n");
			return 1;
		}
	}

	newM = pnewdata->M;
	newV = pnewdata->V;

	newnw = new int*[newV];
	for (w = 0; w < newV; w++) {
		newnw[w] = new int[K];
		for (k = 0; k < K; k++) {
			newnw[w][k] = 0;
		}
	}

	newnd = new int*[newM];
	for (m = 0; m < newM; m++) {
		newnd[m] = new int[K];
		for (k = 0; k < K; k++) {
			newnd[m][k] = 0;
		}
	}

	newnwsum = new int[K];
	for (k = 0; k < K; k++) {
		newnwsum[k] = 0;
	}

	newndsum = new int[newM];
	for (m = 0; m < newM; m++) {
		newndsum[m] = 0;
	}

	srandom(time(0)); // initialize for random number generation
	newz = new int*[newM];
	for (m = 0; m < pnewdata->M; m++) {
		int N = pnewdata->docs[m]->length;
		newz[m] = new int[N];

		// assign values for nw, nd, nwsum, and ndsum	
		for (n = 0; n < N; n++) {
			int w = pnewdata->docs[m]->words[n];
			int _w = pnewdata->_docs[m]->words[n];
			int topic = (int)(((double)random() / RAND_MAX) * K);
			newz[m][n] = topic;

			// number of instances of word i assigned to topic j
			newnw[_w][topic] += 1;
			// number of words in document i assigned to topic j
			newnd[m][topic] += 1;
			// total number of words assigned to topic j
			newnwsum[topic] += 1;
		}
		// total number of words in document i
		newndsum[m] = N;
	}

	newtheta = new double*[newM];
	for (m = 0; m < newM; m++) {
		newtheta[m] = new double[K];
	}

	newphi = new double*[K];
	for (k = 0; k < K; k++) {
		newphi[k] = new double[newV];
	}

	return 0;
}

void model::inference() {
	if (twords > 0) {
		// print out top words per topic
		dataset::read_wordmap(dir + wordmapfile, &id2word);
	}

	printf("Sampling %d iterations for inference!\n", niters);

	for (inf_liter = 1; inf_liter <= niters; inf_liter++) {
		printf("Iteration %d ...\n", inf_liter);

		// for all newz_i
		for (int m = 0; m < newM; m++) {
			for (int n = 0; n < pnewdata->docs[m]->length; n++) {
				// (newz_i = newz[m][n])
				// sample from p(z_i|z_-i, w)
				int topic = inf_sampling(m, n);
				newz[m][n] = topic;
			}
		}
	}

	printf("Gibbs sampling for inference completed!\n");
	printf("Saving the inference outputs!\n");
	compute_newtheta();
	compute_newphi();
	inf_liter--;
	save_inf_model(dfile);
}

int model::inf_sampling(int m, int n) {
	// remove z_i from the count variables
	int topic = newz[m][n];
	int w = pnewdata->docs[m]->words[n];
	int _w = pnewdata->_docs[m]->words[n];
	newnw[_w][topic] -= 1;
	newnd[m][topic] -= 1;
	newnwsum[topic] -= 1;
	newndsum[m] -= 1;

	double Vbeta = V * beta;
	double Kalpha = K * alpha;
	// do multinomial sampling via cumulative method
	for (int k = 0; k < K; k++) {
		p[k] = (nw[w][k] + newnw[_w][k] + beta) / (nwsum[k] + newnwsum[k] + Vbeta) *
			(newnd[m][k] + alpha) / (newndsum[m] + Kalpha);
	}
	// cumulate multinomial parameters
	for (int k = 1; k < K; k++) {
		p[k] += p[k - 1];
	}
	// scaled sample because of unnormalized p[]
	double u = ((double)random() / RAND_MAX) * p[K - 1];

	for (topic = 0; topic < K; topic++) {
		if (p[topic] > u) {
			break;
		}
	}

	// add newly estimated z_i to count variables
	newnw[_w][topic] += 1;
	newnd[m][topic] += 1;
	newnwsum[topic] += 1;
	newndsum[m] += 1;

	return topic;
}

void model::compute_newtheta() {
	for (int m = 0; m < newM; m++) {
		for (int k = 0; k < K; k++) {
			newtheta[m][k] = (newnd[m][k] + alpha) / (newndsum[m] + K * alpha);
		}
	}
}

void model::compute_newphi() {
	map<int, int>::iterator it;
	for (int k = 0; k < K; k++) {
		for (int w = 0; w < newV; w++) {
			it = pnewdata->_id2id.find(w);
			if (it != pnewdata->_id2id.end()) {
				newphi[k][w] = (nw[it->second][k] + newnw[w][k] + beta) / (nwsum[k] + newnwsum[k] + V * beta);
			}
		}
	}
}

